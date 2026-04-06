import fs from "fs";
import path from "path";
import { getNextNode } from "../config/loadBalancer";
import FormData from "form-data";
import axios from "axios";
import { addLog } from "../utils/logger";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export const splitFileIntoChunks = async (
  filePath: string,
  fileId: string,
): Promise<{ chunkIndex: number; path: string; node: string[] }[]> => {
  return new Promise((resolve, reject) => {
    const chunks: { chunkIndex: number; path: string; node: string[] }[] = [];

    const readStream = fs.createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
    });

    let chunkIndex = 0;

    readStream.on("data", async (chunk) => {
      readStream.pause();

      try {
        addLog(`📦 Processing chunk ${chunkIndex}`);
        const chunkFileName = `${fileId}_chunk_${chunkIndex}`;
        const chunkPath = path.join("uploads/chunks", chunkFileName);

        await fs.promises.writeFile(chunkPath, chunk);

        const nodes = getNextNode(3);
        const replicationFactor = 2;

        const result = await uploadChunkToNode(
          chunkPath,
          nodes,
          replicationFactor,
        );

        chunks.push({
          chunkIndex,
          path: result.storedFilename,
          node: result.nodes,
        });

        await fs.promises.unlink(chunkPath);

        chunkIndex++;
        addLog(
          `🎯 Chunk ${chunkIndex} replicated to ${result.nodes.join(", ")}`,
        );
        readStream.resume();
        // console.log(`Chunk ${chunkIndex} →`, uploadedNodes);
      } catch (err) {
        reject(err);
      }
    });

    readStream.on("end", () => {
      resolve(chunks);
    });

    readStream.on("error", (err) => {
      reject(err);
    });
  });
};

export const getChunkStream = async (chunk: any) => {
  for (const node of chunk.node) {
    try {
      console.log(`Trying node: ${node}`);
      addLog(`Trying node → ${node}`);

      const response = await axios.get(`${node}/storage/chunk/${chunk.path}`, {
        responseType: "stream",
      });

      console.log(`Success from: ${node}`);
      addLog(`✅ Chunk fetched from ${node}`);
      return response.data;
    } catch (err: any) {
      console.error(`Failed to fetch from ${node}:`, err.message);
      addLog("❌ All nodes failed for chunk");
    }
  }
  addLog("❌ All nodes failed for chunk");
  throw new Error("All nodes failed to provide the chunk");
};

export const uploadChunkToNode = async (
  chunkPath: string,
  nodes: string[],
  replicationFactor: number,
) => {
  const successfulNodes: string[] = [];
  let storedFilename = "";

  for (const node of nodes) {
    try {
      console.log(`Uploading to ${node}`);
      addLog(`Uploading chunk → ${node}`);

      const form = new FormData();
      form.append("chunk", fs.createReadStream(chunkPath));

      const response = await axios.post(`${node}/storage/upload`, form, {
        headers: form.getHeaders(),
        timeout: 5000,
      });

      if (!storedFilename) {
        storedFilename = response.data.file;
      }

      successfulNodes.push(node);

      addLog(`✅ Stored chunk in ${node}`);

      if (successfulNodes.length >= replicationFactor) {
        break;
      }
    } catch (err: any) {
      console.error(`Failed to upload to ${node}:`, err.message);
      addLog(`❌ Failed upload → ${node}`);
    }
  }

  if (successfulNodes.length < replicationFactor) {
    throw new Error("Replication failed: Not enough nodes available");
  }

  return {
    storedFilename,
    nodes: successfulNodes,
  };
};

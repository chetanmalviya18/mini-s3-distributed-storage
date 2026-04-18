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
): Promise<{ chunkIndex: number; path: string; node: string }[]> => {
  return new Promise((resolve, reject) => {
    const chunks: { chunkIndex: number; path: string; node: string }[] = [];
    const chunkPromises: Promise<any>[] = [];
    let totalChunksProcessed = 0;

    const readStream = fs.createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
    });

    let chunkIndex = 0;

    readStream.on("data", (chunk) => {
      readStream.pause();

      const chunkIdx = chunkIndex;
      console.log(`📤 Data event #${chunkIdx}, paused stream`);

      const chunkPromise = (async () => {
        try {
          console.log(`📦 Starting chunk ${chunkIdx} upload`);
          addLog(`📦 Processing chunk ${chunkIdx}`);
          const chunkFileName = `${fileId}_chunk_${chunkIdx}`;
          const chunkPath = path.join("uploads/chunks", chunkFileName);

          await fs.promises.writeFile(chunkPath, chunk);

          const nodes = getNextNode(3);
          const replicationFactor = 2;

          const result = await uploadChunkToNode(
            chunkPath,
            nodes,
            replicationFactor,
          );

          // Create separate DB entries for each replicated node with unique filename
          for (const uploadResult of result) {
            chunks.push({
              chunkIndex: chunkIdx,
              path: uploadResult.filename,
              node: uploadResult.node,
            });
          }

          await fs.promises.unlink(chunkPath);

          console.log(`✅ Chunk ${chunkIdx} complete`);
          const nodeUrls = result.map((r) => r.node).join(", ");
          addLog(`🎯 Chunk ${chunkIdx} replicated to ${nodeUrls}`);
        } catch (err) {
          console.error(`❌ Chunk ${chunkIdx} failed:`, err);
          throw err;
        }
      })();

      chunkPromises.push(chunkPromise);
      totalChunksProcessed++;
      chunkIndex++;
      readStream.resume();
    });

    readStream.on("end", async () => {
      console.log(
        `🔚 Stream ended. Total data events: ${totalChunksProcessed}, waiting for ${chunkPromises.length} promises`,
      );
      try {
        // Wait for ALL chunk operations to complete before resolving
        await Promise.all(chunkPromises);
        const validChunks = chunks.filter((c) => c !== undefined);
        console.log(
          `✅ All chunks complete. Saving ${validChunks.length} chunks to DB`,
        );
        resolve(validChunks);
      } catch (err) {
        console.error(`❌ Chunk processing failed:`, err);
        reject(err);
      }
    });

    readStream.on("error", (err) => {
      console.error(`❌ Stream error:`, err);
      reject(err);
    });
  });
};

export const getChunkStream = async (chunk: any) => {
  // chunk.node is now a single-element array with one node URL
  const nodeUrl = chunk.node[0];

  try {
    console.log(`Trying node: ${nodeUrl}`);
    addLog(`Trying node → ${nodeUrl}`);

    const response = await axios.get(`${nodeUrl}/storage/chunk/${chunk.path}`, {
      responseType: "stream",
    });

    console.log(`Success from: ${nodeUrl}`);
    addLog(`✅ Chunk fetched from ${nodeUrl}`);
    return response.data;
  } catch (err: any) {
    console.error(`Failed to fetch from ${nodeUrl}:`, err.message);
    addLog(`❌ Failed to fetch chunk from ${nodeUrl}`);
    throw new Error(`Failed to fetch chunk from ${nodeUrl}: ${err.message}`);
  }
};

export const uploadChunkToNode = async (
  chunkPath: string,
  nodes: string[],
  replicationFactor: number,
) => {
  const uploadResults: { node: string; filename: string }[] = [];

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

      uploadResults.push({
        node,
        filename: response.data.file,
      });

      addLog(`✅ Stored chunk in ${node}`);

      if (uploadResults.length >= replicationFactor) {
        break;
      }
    } catch (err: any) {
      console.error(`Failed to upload to ${node}:`, err.message);
      addLog(`❌ Failed upload → ${node}`);
    }
  }

  if (uploadResults.length < replicationFactor) {
    throw new Error("Replication failed: Not enough nodes available");
  }

  return uploadResults;
};

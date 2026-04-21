import axios from "axios";
import FormData from "form-data";
import { Readable } from "stream";
import { getNextNode } from "../config/loadBalancer";

export const uploadChunkToNodeBuffer = async (
  chunk: Buffer,
  chunkIndex: number,
) => {
  const nodes = getNextNode(3);
  const replicationFactor = 2;

  const results: { node: string; filename: string; chunkIndex: number }[] = [];

  for (const node of nodes) {
    try {
      const form = new FormData();

      form.append("chunk", Readable.from(chunk), {
        filename: `chunk_${chunkIndex}`,
      });

      const res = await axios.post(`${node}/storage/upload`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      results.push({
        node,
        filename: res.data.file,
        chunkIndex,
      });

      if (results.length >= replicationFactor) break;
    } catch (err) {
      console.error("Node upload failed:", node);
    }
  }

  if (results.length < replicationFactor) {
    throw new Error(
      `Failed to replicate chunk ${chunkIndex}. Required ${replicationFactor} replicas, but only achieved ${results.length}.`,
    );
  }

  return results;
};

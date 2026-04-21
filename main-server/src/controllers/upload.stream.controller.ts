import { Request, Response } from "express";
import Busboy from "busboy";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { v4 as uuidv4 } from "uuid";
import { uploadChunkToNode } from "../services/chunk.service";
import { addLog } from "../utils/logger";
import { uploadChunkToNodeBuffer } from "./upload.controller";

const CHUNK_SIZE = 10 * 1024 * 1024;

export const uploadStreamController = (req: Request, res: Response) => {
  const busboy = Busboy({ headers: req.headers });

  const publicId = uuidv4();
  const hash = crypto.createHash("sha256");

  let buffer = Buffer.alloc(0);
  let chunkIndex = 0;
  let totalSize = 0;
  const chunkResults: { node: string; filename: string; chunkIndex: number }[] =
    [];

  busboy.on("file", (_, file, info) => {
    const { filename } = info;

    file.pause();
    file.on("data", async (data: Buffer) => {
      hash.update(data);
      totalSize += data.length;

      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= CHUNK_SIZE) {
        const chunk = buffer.slice(0, CHUNK_SIZE);
        buffer = buffer.slice(CHUNK_SIZE);

        const currentIndex = chunkIndex++;

        try {
          const result = await uploadChunkToNodeBuffer(chunk, currentIndex);
          chunkResults.push(...result);
          console.log(`Chunk ${currentIndex} uploaded`);
        } catch (err) {
          console.error(`Chunk ${currentIndex} upload failed:`, err);
          file.destroy();
          return res.status(500).json({ message: "Chunk upload failed" });
        }
      }

      file.resume();
    });

    file.on("end", async () => {
      // Remaining chunk
      if (buffer.length > 0) {
        const result = await uploadChunkToNodeBuffer(buffer, chunkIndex++);
        chunkResults.push(...result);
      }

      const fileHash = hash.digest("hex");

      // 🔥 Dedup check
      const existing = await prisma.file.findUnique({
        where: { fileHash },
      });

      if (existing) {
        return res.json({
          message: "Duplicate file",
          link: `${process.env.FRONTEND_URL}/file/${existing.publicId}`,
        });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const fileRecord = await prisma.file.create({
        data: {
          originalName: filename,
          size: BigInt(totalSize),
          publicId,
          fileHash,
          expiresAt,
        },
      });

      await prisma.chunk.createMany({
        data: chunkResults.map((c) => ({
          fileId: fileRecord.id,
          chunkIndex: c.chunkIndex,
          path: c.filename,
          node: c.node,
        })),
      });

      res.json({
        message: "Upload complete",
        link: `${process.env.FRONTEND_URL}/file/${publicId}`,
      });
    });
  });

  req.pipe(busboy);
};

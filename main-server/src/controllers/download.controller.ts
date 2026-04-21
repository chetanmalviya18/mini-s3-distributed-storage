import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { getChunkStream } from "../services/chunk.service";

export const downloadFile = async (req: Request, res: Response, next: any) => {
  try {
    const fileId = req.params.id as string;
    const file = await prisma.file.findFirst({
      where: {
        OR: [{ publicId: fileId }, { id: fileId }],
      },
      include: { chunks: true },
    });

    if (!file) return res.status(404).json({ message: "File not found" });

    if (new Date() > file.expiresAt) {
      return res
        .status(410)
        .json({ message: "This transfer link has expired" });
    }

    const sortedChunks = file.chunks.sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );

    // Group chunks by chunkIndex to handle multiple replicas
    const chunksByIndex = new Map<number, typeof file.chunks>();
    for (const chunk of sortedChunks) {
      if (!chunksByIndex.has(chunk.chunkIndex)) {
        chunksByIndex.set(chunk.chunkIndex, []);
      }
      chunksByIndex.get(chunk.chunkIndex)!.push(chunk);
    }

    const maxChunkIndex = Math.max(...Array.from(chunksByIndex.keys()));

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`,
    );
    res.setHeader("Content-Type", "application/octet-stream");

    let currentChunk = 0;

    const streamNextChunk = async () => {
      if (currentChunk > maxChunkIndex) {
        return res.end();
      }

      const chunkReplicas = chunksByIndex.get(currentChunk);
      if (!chunkReplicas || chunkReplicas.length === 0) {
        return next(new Error(`Chunk ${currentChunk} not found`));
      }

      // Try each replica until one succeeds
      let lastError: any = null;
      for (const chunk of chunkReplicas) {
        try {
          const stream = await getChunkStream(chunk);

          stream.on("end", () => {
            currentChunk++;
            streamNextChunk();
          });

          stream.on("error", next);
          stream.pipe(res, { end: false });
          return; // Successfully started streaming
        } catch (err) {
          lastError = err;
          // Try next replica
        }
      }

      // All replicas failed
      return next(
        lastError || new Error(`Failed to fetch chunk ${currentChunk}`),
      );
    };

    streamNextChunk();
  } catch (error) {
    next(error);
  }
};

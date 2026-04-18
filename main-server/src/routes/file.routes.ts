import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { getChunkStream, splitFileIntoChunks } from "../services/chunk.service";
import axios from "axios";
import { serializeBigInt } from "../utils/serializer";
import { v4 as uuidv4 } from "uuid";
import { calculateFileHash } from "../utils/fileHash";
import { addLog } from "../utils/logger";

const router = Router();

const upload = multer({
  dest: "uploads/chunks",
});

router.get("/", async (req, res, next) => {
  try {
    const files = await prisma.file.findMany({
      orderBy: { createdAt: "desc" },
      include: { chunks: true },
    });

    res.json(serializeBigInt(files));
  } catch (err) {
    next(err);
  }
});

router.route("/upload").post((req, res, next) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) return next(err);
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const fileHash = await calculateFileHash(req.file.path);
      const existingFile = await prisma.file.findUnique({
        where: { fileHash },
      });

      if (existingFile) {
        console.log("⚡ Duplicate detected");
        addLog("⚡ Duplicate detected");

        fs.unlinkSync(req.file.path);

        const downloadLink = `${process.env.FRONTEND_URL}/file/${existingFile.publicId}`;

        return res.status(200).json({
          message: "File already exists",
          link: downloadLink,
          fileId: existingFile.id,
        });
      }

      const publicId = uuidv4();

      const expiresAt = new Date(Date.now() + 60 * 1000);

      const file = await prisma.file.create({
        data: {
          originalName: req.file.originalname,
          size: req.file.size,
          publicId,
          fileHash,
          expiresAt,
        },
      });

      const chunks = await splitFileIntoChunks(req.file.path, file.id);

      await prisma.chunk.createMany({
        data: chunks.map((chunk) => ({
          fileId: file.id,
          chunkIndex: chunk.chunkIndex,
          path: chunk.path,
          node: [chunk.node], // Wrap single node in array for DB compatibility
        })),
      });

      fs.unlinkSync(req.file.path);

      const downloadLink = `${process.env.FRONTEND_URL}/file/${publicId}`;

      res.status(200).json({
        message: "File uploaded successfully",
        link: downloadLink,
        fileId: file.id,
        totalChunks: chunks.length,
      });
    } catch (error) {
      next(error);
    }
  });
});

router.route("/download/:id").get(async (req, res, next) => {
  try {
    let file = await prisma.file.findUnique({
      where: { id: req.params.id },
      include: { chunks: true },
    });

    if (!file) {
      file = await prisma.file.findUnique({
        where: { publicId: req.params.id },
        include: { chunks: true },
      });
    }

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
      return next(lastError || new Error(`Failed to fetch chunk ${currentChunk}`));
    };

    streamNextChunk();
  } catch (error) {
    next(error);
  }
});

export default router;

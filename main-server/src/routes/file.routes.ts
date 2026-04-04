import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { getChunkStream, splitFileIntoChunks } from "../services/chunk.service";
import axios from "axios";

const router = Router();

const upload = multer({
  dest: "uploads/",
  // fileFilter: (req, file, cb) => {
  //   if (!file.mimetype.startsWith("image/")) {
  //     return cb(new Error("Only images allowed"));
  //   }

  //   cb(null, true);
  // },
});

router.route("/upload").post((req, res, next) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) return next(err);
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const file = await prisma.file.create({
        data: {
          originalName: req.file.originalname,
          size: req.file.size,
        },
      });

      const chunks = await splitFileIntoChunks(req.file.path, file.id);

      await prisma.chunk.createMany({
        data: chunks.map((chunk) => ({
          fileId: file.id,
          chunkIndex: chunk.chunkIndex,
          path: chunk.path,
          node: chunk.node,
        })),
      });

      fs.unlinkSync(req.file.path);

      res.status(200).json({
        message: "File uploaded successfully",
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
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
      include: { chunks: true },
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const sortedChunks = file.chunks.sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`,
    );
    res.setHeader("Content-Type", "application/octet-stream");

    let currentChunk = 0;

    const streamNextChunk = async () => {
      if (currentChunk >= sortedChunks.length) {
        return res.end();
      }

      const chunk = sortedChunks[currentChunk];

      try {
        const stream = await getChunkStream(chunk);

        stream.on("end", () => {
          currentChunk++;
          streamNextChunk();
        });

        stream.on("error", next);
        stream.pipe(res, { end: false });
      } catch (err) {
        return next(err);
      }
    };

    streamNextChunk();
  } catch (error) {
    next(error);
  }
});

export default router;

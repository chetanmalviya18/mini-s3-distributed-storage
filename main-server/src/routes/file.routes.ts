import { Router } from "express";
import { prisma } from "../config/prisma";
import { serializeBigInt } from "../utils/serializer";
import { uploadStreamController } from "../controllers/upload.stream.controller";
import { metaData } from "../controllers/metadata.controller";
import { downloadFile } from "../controllers/download.controller";

const router = Router();

router.get("/metadata/:id", metaData);

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

router.route("/upload").post(uploadStreamController);

router.route("/download/:id").get(downloadFile);

export default router;

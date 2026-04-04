import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const upload = multer({ dest: "./src/storage/" });

router.route("/upload").post(upload.single("chunk"), (req, res) => {
  res.json({ message: "Chunk stored", file: req.file?.filename });
});

router.route("/chunk/:filename").get((req, res) => {
  const filePath = path.join("./src/storage", req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Chunk not found" });
  }

  res.sendFile(path.resolve(filePath));
});

export default router;

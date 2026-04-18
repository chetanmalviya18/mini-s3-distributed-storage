import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const storageDir = path.join(process.cwd(), "storage");
const upload = multer({ dest: storageDir });

// Helper to delete file with retry logic for locked files
const deleteFileWithRetry = async (
  filePath: string,
  maxRetries: number = 3,
  delayMs: number = 100,
): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.promises.unlink(filePath);
      console.log(`🗑 Deleted: ${filePath}`);
      return;
    } catch (err: any) {
      if (err.code === "EPERM" && attempt < maxRetries) {
        console.log(
          `⏳ File locked, retry ${attempt}/${maxRetries} in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
};

router.route("/upload").post(upload.single("chunk"), (req, res) => {
  res.json({ message: "Chunk stored", file: req.file?.filename });
});

router.route("/chunk/:filename").get((req, res) => {
  const filePath = path.join(storageDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Chunk not found" });
  }

  res.sendFile(path.resolve(filePath));
});

router.delete("/chunk/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    const filePath = path.join(storageDir, filename);
    console.log(`🔍 DELETE request for: ${filename}`);
    console.log(`📂 Storage dir: ${storageDir}`);
    console.log(`📄 Full path: ${filePath}`);
    console.log(`✓ Exists: ${fs.existsSync(filePath)}`);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({ message: "Chunk not found" });
    }

    try {
      await deleteFileWithRetry(filePath);
      return res.json({ message: "Chunk deleted successfully" });
    } catch (unlinkErr: any) {
      console.error(`❌ Error deleting file ${filePath}:`, unlinkErr.message);
      return res.status(500).json({ message: "Error deleting chunk" });
    }
  } catch (err) {
    console.error(`❌ Unexpected error in DELETE handler:`, err);
    return res.status(500).json({ message: "Error deleting chunk" });
  }
});

export default router;

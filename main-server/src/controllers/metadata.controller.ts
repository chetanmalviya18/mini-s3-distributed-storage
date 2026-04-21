import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const metaData = async (req: Request, res: Response) => {
  try {
    const searchId = req.params.id as string;

    const file = await prisma.file.findFirst({
      where: {
        OR: [{ publicId: searchId }, { id: searchId }],
      },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({
      originalName: file.originalName,
      size: file.size.toString(),
    });
  } catch (err) {
    console.error("Metadata API Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

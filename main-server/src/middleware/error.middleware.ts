import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.log.error("ERROR 💥:", err);

  // Multer Error
  if (err.name === "MulterError") {
    return res.status(400).json({
      status: "fail",
      message: "File upload error: " + err.message,
    });
  }

  // Custom Error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "fail",
      message: err.message,
    });
  }

  // Unknown Error
  return res.status(500).json({
    status: "error",
    message: "Something went wrong",
  });
};

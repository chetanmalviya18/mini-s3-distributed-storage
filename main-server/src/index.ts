import express, { Request, Response } from "express";
import dotenv from "dotenv";
import fileRoutes from "./routes/file.routes";
import { globalErrorHandler } from "./middleware/error.middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/files", fileRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Mini S3 is running 🚀");
});

// Error handling middleware MUST be last
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

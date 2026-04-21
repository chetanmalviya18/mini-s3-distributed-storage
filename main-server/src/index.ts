import express from "express";
import cors from "cors";
import { fork } from "child_process";
import path from "path";
import fileRoutes from "./routes/file.routes";
import logRoutes from "./routes/log.routes";
import { httpLogger } from "./middleware/logger.middleware";
import { globalErrorHandler } from "./middleware/error.middleware";
import { logger } from "./utils/logger";

// --- Main Application Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(httpLogger);

// Setup routes
app.use("/api/files", fileRoutes);
app.use("/api/logs", logRoutes);

// --- Worker Initialization Function ---
function startWorkers() {
  const isDevelopment = process.env.NODE_ENV === "development";

  const workerFile = isDevelopment ? "cleanup.worker.ts" : "cleanup.worker.js";
  const workerPath = path.join(__dirname, "workers", workerFile);

  // logger.info(`[MainApp] Forking worker from path: ${workerPath}`);
  const worker = fork(workerPath);

  worker.on("online", () => {
    logger.info("[MainApp] Cleanup worker is online.");
  });

  worker.on("exit", (code) => {
    logger.info(`[MainApp] Cleanup worker exited with code ${code}.`);
  });

  worker.on("error", (error) => {
    logger.error(error, "[MainApp] Cleanup worker encountered an error");
  });
}

app.listen(PORT, () => {
  logger.info(`[MainApp] Server is running on http://localhost:${PORT}`);
  startWorkers();
});

app.use(globalErrorHandler);

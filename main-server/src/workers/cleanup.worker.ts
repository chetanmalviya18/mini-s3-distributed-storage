import cron from "node-cron";
import { prisma } from "../config/prisma";
import axios from "axios";
import { logger } from "../utils/logger";

logger.info(`[Worker] Cleanup worker process started with PID: ${process.pid}`);

cron.schedule("* * * * *", async () => {
  logger.info("Running cleanup job...");

  try {
    const expiredFiles = await prisma.file.findMany({
      where: { expiresAt: { lt: new Date() } },
      include: { chunks: true },
    });

    if (expiredFiles.length === 0) {
      logger.info("No expired files found");
      return;
    }

    let deletedFileCount = 0;

    for (const file of expiredFiles) {
      logger.info(`Processing file ${file.id}`);

      let successCount = 0;
      let failedCount = 0;

      for (const chunk of file.chunks) {
        // chunk.node is now a single-element array with one node URL
        const nodeUrl = chunk.node;

        try {
          logger.info(`Deleting ${chunk.path} from ${nodeUrl}`);

          await axios.delete(`${nodeUrl}/storage/chunk/${chunk.path}`, {
            timeout: 5000,
          });

          logger.info(`Deleted from ${nodeUrl}`);
          successCount++;
        } catch (err: any) {
          // Treat 404 as success since chunk is already gone
          if (err.response?.status === 404) {
            logger.info(`Chunk already deleted from ${nodeUrl}`);
            successCount++;
            continue;
          }

          // Treat 500 (EPERM/locked files) as retriable - don't mark as failed
          if (err.response?.status === 500) {
            logger.warn(
              `Temporary error on ${nodeUrl} for ${chunk.path}: ${err.message}`,
            );
            failedCount++;
            continue;
          }

          logger.error(`Failed on ${nodeUrl} for ${chunk.path}:`, err.message);

          failedCount++;
        }
      }

      if (failedCount === 0) {
        // All chunks deleted successfully
        await prisma.chunk.deleteMany({
          where: { fileId: file.id },
        });

        await prisma.file.delete({
          where: { id: file.id },
        });

        deletedFileCount++;
        logger.info(
          `File ${file.id} fully cleaned (${successCount} replicas deleted)`,
        );
      } else {
        logger.warn(
          `File ${file.id} has ${failedCount} chunks that couldn't be deleted. It will be retried in the next cleanup cycle.`,
        );
      }
    }
    logger.info({
      deletedFiles: deletedFileCount,
      message: "Cleanup complete",
    });
  } catch (error) {
    logger.error(error, "Error occurred while running cleanup job");
  }
});

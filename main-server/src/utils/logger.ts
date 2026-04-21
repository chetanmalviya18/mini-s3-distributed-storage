import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: "info",
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }),
});

export const workLogger = logger.child({
  service: "cleanup-worker",
});

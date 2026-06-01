import pino from "pino";

const level = process.env.LOG_LEVEL || "info";

// pino-pretty only in dev (TTY). In production emit JSON lines.
const transport =
  process.stdout.isTTY && process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } }
    : undefined;

export const logger = pino({ level, transport });

export type Logger = typeof logger;

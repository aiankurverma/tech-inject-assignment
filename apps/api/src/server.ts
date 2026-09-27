import mongoose from "mongoose";
import { closeRedis } from "@ti/redis";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { log } from "./utils/logger";
import { loadTheme } from "./services/theme";

const env = loadEnv();
await mongoose.connect(env.MONGODB_URI);
log.info("database connected");

const app = createApp(env, loadTheme());
const server = app.listen(env.PORT, () => {
  log.info("server listening", { port: env.PORT, origin: env.PUBLIC_ORIGIN });
});

// Render's free plan sleeps after 15 idle minutes; a request through the public URL keeps it awake.
const keepAlive = env.KEEP_ALIVE_MINUTES
  ? setInterval(() => {
      fetch(`${env.PUBLIC_ORIGIN}/api/health`)
        .then((r) => log.info("keep-alive ping", { status: r.status }))
        .catch((e: Error) => log.warn("keep-alive ping failed", { error: e.message }));
    }, env.KEEP_ALIVE_MINUTES * 60_000)
  : undefined;

const shutdown = () => {
  clearInterval(keepAlive);
  server.close(async () => {
    await app.shutdown();
    await closeRedis();
    await mongoose.disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

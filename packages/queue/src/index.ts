import { randomUUID } from "node:crypto";
import { Queue as BullQueue, Worker } from "bullmq";
import type { Redis } from "@ti/redis";

export type JobState = "queued" | "active" | "completed" | "failed";

export interface JobStatus {
  id: string;
  state: JobState;
  error?: string;
}

export interface Queue<T> {
  add(data: T): Promise<string>;
  status(id: string): Promise<JobStatus | null>;
  close(): Promise<void>;
}

export interface QueueOptions {
  redis: Redis | null;
  concurrency?: number;
}

const KEEP_S = 60 * 60;

/**
 * One background queue. BullMQ on Redis when `redis` is given; otherwise jobs run
 * in this process (async, same interface and statuses), so behaviour is identical without Redis.
 */
export function createQueue<T>(
  name: string,
  processor: (data: T) => Promise<void>,
  { redis, concurrency = 1 }: QueueOptions,
): Queue<T> {
  return redis
    ? bullQueue(name, processor, redis, concurrency)
    : memoryQueue(processor, concurrency);
}

function bullQueue<T>(
  name: string,
  processor: (data: T) => Promise<void>,
  redis: Redis,
  concurrency: number,
): Queue<T> {
  // BullMQ needs its own connections with maxRetriesPerRequest: null (the worker blocks on them).
  const connect = () => redis.duplicate({ maxRetriesPerRequest: null });
  const queueConn = connect();
  const workerConn = connect();
  const queue = new BullQueue(name, {
    connection: queueConn,
    defaultJobOptions: { removeOnComplete: { age: KEEP_S }, removeOnFail: { age: KEEP_S } },
  });
  const worker = new Worker(name, (job) => processor(job.data as T), {
    connection: workerConn,
    concurrency,
  });
  worker.on("error", () => undefined); // connection errors are already logged by @ti/redis

  return {
    async add(data) {
      const job = await queue.add(name, data);
      return job.id!;
    },
    async status(id) {
      const job = await queue.getJob(id);
      if (!job) return null;
      const s = await job.getState();
      const state: JobState = s === "active" || s === "completed" || s === "failed" ? s : "queued";
      return state === "failed" ? { id, state, error: job.failedReason } : { id, state };
    },
    async close() {
      await worker.close();
      await queue.close();
      await Promise.all([queueConn.quit(), workerConn.quit()]).catch(() => undefined);
    },
  };
}

function memoryQueue<T>(processor: (data: T) => Promise<void>, concurrency: number): Queue<T> {
  const jobs = new Map<string, JobStatus>();
  const waiting: { id: string; data: T }[] = [];
  const running = new Set<Promise<void>>();

  const pump = () => {
    while (running.size < concurrency && waiting.length) {
      const { id, data } = waiting.shift()!;
      jobs.set(id, { id, state: "active" });
      const p = processor(data)
        .then(
          () => void jobs.set(id, { id, state: "completed" }),
          (e: unknown) =>
            void jobs.set(id, {
              id,
              state: "failed",
              error: e instanceof Error ? e.message : String(e),
            }),
        )
        .finally(() => {
          running.delete(p);
          setTimeout(() => jobs.delete(id), KEEP_S * 1000).unref();
          pump();
        });
      running.add(p);
    }
  };

  return {
    async add(data) {
      const id = randomUUID();
      jobs.set(id, { id, state: "queued" });
      waiting.push({ id, data });
      setImmediate(pump); // always async, like a real queue
      return id;
    },
    async status(id) {
      return jobs.get(id) ?? null;
    },
    async close() {
      waiting.length = 0;
      await Promise.allSettled([...running]);
    },
  };
}

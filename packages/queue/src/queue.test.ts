import { describe, expect, it } from "vitest";
import { createQueue, type Queue } from "./index";

async function settle<T>(queue: Queue<T>, id: string) {
  for (let i = 0; i < 100; i++) {
    const s = await queue.status(id);
    if (s?.state === "completed" || s?.state === "failed") return s;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

describe("queue (in-process, no Redis)", () => {
  it("runs jobs asynchronously and reports status", async () => {
    const done: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const queue = createQueue<{ n: number }>(
      "t",
      async ({ n }) => {
        await gate;
        done.push(n);
      },
      { redis: null },
    );

    const id = await queue.add({ n: 1 });
    expect(await queue.status(id)).toEqual({ id, state: "queued" }); // add never runs inline
    await new Promise((r) => setImmediate(r));
    expect((await queue.status(id))?.state).toBe("active");
    release();
    expect(await settle(queue, id)).toEqual({ id, state: "completed" });
    expect(done).toEqual([1]);
    expect(await queue.status("nope")).toBeNull();
    await queue.close();
  });

  it("marks thrown errors as failed with the message", async () => {
    const queue = createQueue<string>(
      "t",
      async (msg) => {
        throw new Error(msg);
      },
      { redis: null },
    );
    const id = await queue.add("bundle invalid");
    expect(await settle(queue, id)).toEqual({ id, state: "failed", error: "bundle invalid" });
    await queue.close();
  });

  it("respects concurrency", async () => {
    let active = 0;
    let peak = 0;
    const queue = createQueue<number>(
      "t",
      async () => {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      },
      { redis: null, concurrency: 2 },
    );
    const ids = await Promise.all([1, 2, 3, 4, 5].map((n) => queue.add(n)));
    for (const id of ids) await settle(queue, id);
    expect(peak).toBe(2);
    await queue.close();
  });
});

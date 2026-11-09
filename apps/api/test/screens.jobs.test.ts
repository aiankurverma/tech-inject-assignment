import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { customer, login, setup, teardown, type App } from "./helpers";
import { createScreenJob } from "../src/services/screenJobs";

let app: App;

beforeAll(async () => {
  ({ app } = await setup());
});

afterAll(async () => {
  await teardown(app);
});

const PROMPT = "A dashboard with KPI cards, a deals table and an activity timeline";
const tokenHeader = (token: string) => ({ "x-screen-job-token": token });

async function settle(id: string, token: string) {
  for (let i = 0; i < 80; i++) {
    const res = await request(app).get(`/api/screens/jobs/${id}`).set(tokenHeader(token));
    if (["done", "failed", "cancelled"].includes(res.body.status)) return res.body;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("job did not settle");
}

describe("background screen jobs", () => {
  it("queues generation, survives logout, and enforces the job token", async () => {
    const c = await customer({ email: "screens-job@example.com" });
    const agent = await login(app, c);
    const created = await agent.post("/api/screens/generate").send({ prompt: PROMPT });
    expect(created.status).toBe(202);
    expect(created.body.status).toBe("queued");
    expect(typeof created.body.token).toBe("string");

    // No cookie (signed out) and no token: the job is invisible.
    const anonymous = await request(app).get(`/api/screens/jobs/${created.body.id}`);
    expect(anonymous.status).toBe(404);

    // The token alone is enough: progress is readable after signing out.
    const afterLogout = await request(app)
      .get(`/api/screens/jobs/${created.body.id}`)
      .set(tokenHeader(created.body.token));
    expect(afterLogout.status).toBe(200);

    // No AI key (or no components) in tests, so the worker records a durable failure instead of
    // losing the request with the HTTP connection.
    const finished = await settle(created.body.id, created.body.token);
    expect(finished.status).toBe("failed");
    expect(["builder_not_configured", "no_components"]).toContain(finished.error.code);
  });

  it("pauses, resumes and cancels without deleting the prompt or progress", async () => {
    const job = await createScreenJob({ prompt: PROMPT, viewer: { kind: "anonymous" } });

    const wrong = await request(app).post(`/api/screens/jobs/${job.id}/pause`);
    expect(wrong.status).toBe(404);

    const paused = await request(app)
      .post(`/api/screens/jobs/${job.id}/pause`)
      .set(tokenHeader(job.token));
    expect(paused.status).toBe(200);
    expect(paused.body).toMatchObject({ status: "paused", prompt: PROMPT });

    const cancelled = await request(app)
      .post(`/api/screens/jobs/${job.id}/cancel`)
      .set(tokenHeader(job.token));
    expect(cancelled.body.status).toBe("cancelled");
    expect(cancelled.body.finishedAt).toBeTruthy();
  });

  it("resumes a paused job back into the queue", async () => {
    const job = await createScreenJob({ prompt: PROMPT, viewer: { kind: "anonymous" } });
    await request(app).post(`/api/screens/jobs/${job.id}/pause`).set(tokenHeader(job.token));
    const resumed = await request(app)
      .post(`/api/screens/jobs/${job.id}/resume`)
      .set(tokenHeader(job.token));
    expect(resumed.status).toBe(200);
    expect(["queued", "running", "failed"]).toContain(resumed.body.status);
  });

  it("cancels a queued job before it starts", async () => {
    const job = await createScreenJob({ prompt: PROMPT, viewer: { kind: "anonymous" } });
    const cancelled = await request(app)
      .post(`/api/screens/jobs/${job.id}/cancel`)
      .set(tokenHeader(job.token));
    expect(cancelled.body.status).toBe("cancelled");
    // Resuming a cancelled job is a no-op; it stays cancelled.
    const resumed = await request(app)
      .post(`/api/screens/jobs/${job.id}/resume`)
      .set(tokenHeader(job.token));
    expect(resumed.body.status).toBe("cancelled");
  });
});

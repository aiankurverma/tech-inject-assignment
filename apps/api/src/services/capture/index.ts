// Capture job: runs on the background queue, writes progress + result onto the Capture document.
import { CaptureModel } from "../../models";
import { log } from "../../utils/logger";
import { capturePage } from "./browser";
import { assertPublicUrl } from "./guard";
import { buildTokens } from "./tokens";

export interface CaptureJob {
  id: string;
}

export async function processCaptureJob({ id }: CaptureJob) {
  const doc = await CaptureModel.findOneAndUpdate(
    { _id: id, status: "queued" },
    { status: "running" },
    { new: true },
  ).lean();
  if (!doc) return;
  const started = Date.now();
  try {
    // Re-check at run time: DNS may have changed since the request was accepted.
    const guard = await assertPublicUrl(doc.url);
    if (!guard.ok) throw new Error(guard.reason);
    const page = await capturePage(guard.url.href);
    await CaptureModel.updateOne(
      { _id: id },
      {
        status: "done",
        finalUrl: page.finalUrl,
        title: page.title,
        tokens: buildTokens(page.raw),
        inventory: page.inventory,
        screenshot: page.screenshot ?? undefined,
        finishedAt: new Date(),
      },
    );
    log.info("capture done", { id, ms: Date.now() - started });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Capture failed.";
    await CaptureModel.updateOne({ _id: id }, { status: "failed", error, finishedAt: new Date() });
    log.warn("capture failed", { id, error });
  }
}

export { assertPublicUrl, parseCaptureUrl } from "./guard";
export { generateThemeCss, type CaptureTokens } from "./tokens";

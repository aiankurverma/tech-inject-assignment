import {
  agentPromptText,
  buildRegistryItem,
  copyCodeText,
  installCommand,
  type Bundle,
  type ThemeFiles,
} from "@ti/core";
import type { TeamComponentRecord } from "../models";
import { isoDate, placeholderThumbnail, previewPayload } from "./catalog";
import type { TeamScope } from "./teamRepo";
import { teamErrors } from "../utils/http";

/** Thumbnail MIME types a team component may serve. Anything else falls back to the placeholder. */
const THUMBNAIL_MIME = /^data:image\/(png|webp);base64,/;

/** Admin-style row for the team's component grid (drafts included for admins). */
export function teamSummary(d: TeamComponentRecord) {
  return {
    slug: d.slug,
    status: d.status,
    name: d.draft.name,
    category: d.draft.category,
    description: d.draft.description,
    draftVersion: d.draft.version,
    publishedVersion: d.published?.version ?? null,
    publishedAt: isoDate(d.publishedAt),
    updatedAt: isoDate(d.updatedAt),
    hasUnpublishedChanges: !!d.published && JSON.stringify(d.published) !== JSON.stringify(d.draft),
  };
}

/**
 * Read side for one team's private components. Every call goes through `repo`, whose filters
 * carry the team id, and only the immutable `published` snapshot is ever served. There is no
 * cache: membership was checked on this very request and the answer must not outlive it.
 */
export function makeTeamCatalog(theme: ThemeFiles, apiOrigin: string) {
  const published = async (repo: TeamScope, slug: string): Promise<Bundle> => {
    const doc = await repo.getPublished(slug);
    if (!doc?.published) throw teamErrors.notFound();
    return doc.published;
  };

  return {
    async list(repo: TeamScope, includeDrafts: boolean) {
      const docs = await repo.list(includeDrafts ? undefined : "published");
      return docs
        .filter((d) => includeDrafts || d.published)
        .map((d) => ({
          ...teamSummary(d),
          team: repo.teamSlug,
          // Published rows describe the live snapshot; draft-only rows describe the draft.
          name: d.published?.name ?? d.draft.name,
          category: d.published?.category ?? d.draft.category,
          description: d.published?.description ?? d.draft.description,
          version: d.published?.version ?? d.draft.version,
        }));
    },

    async detail(repo: TeamScope, slug: string) {
      const doc = await repo.getPublished(slug);
      if (!doc?.published) throw teamErrors.notFound();
      const b = doc.published;
      const item = buildRegistryItem(b, theme);
      return {
        slug: b.slug,
        name: b.name,
        description: b.description,
        category: b.category,
        access: "free" as const,
        version: b.version,
        publishedAt: isoDate(doc.publishedAt),
        team: repo.teamSlug,
        locked: null,
        props: b.props,
        usage: b.usage,
        dependencies: item.dependencies,
        examples: b.examples,
        files: item.files,
        installCommand: installCommand(apiOrigin, b.slug, repo.teamSlug),
      };
    },

    /** Returns `{ mime, bytes }`; only PNG/WebP uploads are served, otherwise a generated SVG. */
    async thumbnail(repo: TeamScope, slug: string, draft = false) {
      const doc = draft ? await repo.get(slug) : await repo.getPublished(slug);
      const b = draft ? doc?.draft : doc?.published;
      if (!b) throw teamErrors.notFound();
      return decodeThumbnail(
        THUMBNAIL_MIME.test(b.thumbnail ?? "") ? b.thumbnail! : placeholderThumbnail(b.name),
      );
    },

    async preview(repo: TeamScope, slug: string) {
      return previewPayload(await published(repo, slug), theme);
    },
    async registryItem(repo: TeamScope, slug: string) {
      return buildRegistryItem(await published(repo, slug), theme);
    },
    async copyCode(repo: TeamScope, slug: string) {
      return copyCodeText(buildRegistryItem(await published(repo, slug), theme));
    },
    async prompt(repo: TeamScope, slug: string) {
      const b = await published(repo, slug);
      return agentPromptText(buildRegistryItem(b, theme), {
        apiOrigin,
        auth: "team",
        team: repo.teamSlug,
      });
    },
  };
}

/** Splits a data URL into its MIME type and raw bytes. */
export function decodeThumbnail(dataUrl: string) {
  const [, mime, b64] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl) ?? [];
  return { mime: mime ?? "image/svg+xml", bytes: Buffer.from(b64 ?? "", "base64") };
}

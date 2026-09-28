import * as React from "react";
import { Check, Globe, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Select, type SelectOption } from "@/components/crm/select";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { ColorSwatches } from "@/components/crm/color-picker";
import { tagColors, type TagColor } from "@/components/crm/tag";

export interface WorkspaceDraft {
  name: string;
  slug: string;
  teamSize: string;
  region: string;
  color: TagColor;
}

export type SlugAvailability = "available" | "taken" | "reserved";

export interface WorkspaceCreateProps {
  /** Base URL shown before the slug, e.g. "kitbase.app/". */
  domain?: string;
  regions?: SelectOption[];
  teamSizes?: { value: string; label: string }[];
  /** Server check for the slug; debounced 350ms. */
  checkSlug?: (slug: string) => Promise<SlugAvailability>;
  onCreate: (draft: WorkspaceDraft) => Promise<void> | void;
  onCancel?: () => void;
  defaultValues?: Partial<WorkspaceDraft>;
  className?: string;
}

const RESERVED = new Set(["admin", "api", "app", "www", "help", "billing", "login", "settings"]);

/** Lowercase, ASCII, dash-separated, 3-40 chars. */
export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function slugProblem(slug: string) {
  if (slug.length < 3) return "At least 3 characters";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug))
    return "Use lowercase letters, numbers and single dashes";
  if (/--/.test(slug)) return "No double dashes";
  if (RESERVED.has(slug)) return "This URL is reserved";
  return null;
}

const DEFAULT_REGIONS: SelectOption[] = [
  { value: "us-east", label: "United States (Virginia)" },
  { value: "eu-central", label: "European Union (Frankfurt)" },
  { value: "ap-south", label: "India (Mumbai)" },
  { value: "ap-southeast", label: "Australia (Sydney)" },
];
const DEFAULT_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2-10" },
  { value: "11-50", label: "11-50" },
  { value: "51+", label: "51+" },
];

/** New workspace form: auto-derived URL slug with format rules, reserved words and debounced availability check, region (data residency), team size and brand colour. */
export function WorkspaceCreate({
  domain = "kitbase.app/",
  regions = DEFAULT_REGIONS,
  teamSizes = DEFAULT_SIZES,
  checkSlug,
  onCreate,
  onCancel,
  defaultValues,
  className,
}: WorkspaceCreateProps) {
  const [draft, setDraft] = React.useState<WorkspaceDraft>({
    name: "",
    slug: "",
    teamSize: teamSizes[1]?.value ?? "",
    region: regions[0]?.value ?? "",
    color: "purple",
    ...defaultValues,
  });
  const [slugEdited, setSlugEdited] = React.useState(!!defaultValues?.slug);
  const [availability, setAvailability] = React.useState<
    SlugAvailability | "checking" | "error" | null
  >(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  const localProblem = draft.slug ? slugProblem(draft.slug) : "Required";
  const nameProblem = draft.name.trim().length < 2 ? "Enter a workspace name" : null;

  React.useEffect(() => {
    if (!checkSlug || localProblem) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setAvailability("checking");
    const t = window.setTimeout(() => {
      checkSlug(draft.slug).then(
        (r) => !cancelled && setAvailability(r),
        () => !cancelled && setAvailability("error"),
      );
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [draft.slug, checkSlug, localProblem]);

  const slugError =
    localProblem && (submitted || draft.slug)
      ? localProblem
      : availability === "taken"
        ? "Already taken, try another"
        : availability === "reserved"
          ? "This URL is reserved"
          : null;

  const canSubmit =
    !nameProblem &&
    !localProblem &&
    (!checkSlug || availability === "available" || availability === "error") &&
    !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ ...draft, name: draft.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the workspace.");
    } finally {
      setBusy(false);
    }
  };

  const initials =
    draft.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "W";

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className={cn(
        "flex w-full max-w-lg flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-crm-border p-5">
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl border text-base font-medium",
            tagColors[draft.color],
          )}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="truncate text-lg font-medium">
            {draft.name.trim() || "Create a workspace"}
          </h2>
          <p className="truncate text-xs text-crm-muted-fg">
            {domain}
            <span className="text-crm-soft">{draft.slug || "your-team"}</span>
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <FormField
          label="Workspace name"
          htmlFor={`${id}-name`}
          required
          error={submitted && nameProblem ? nameProblem : undefined}
        >
          <Input
            id={`${id}-name`}
            autoFocus
            maxLength={60}
            placeholder="Northwind Sales"
            value={draft.name}
            invalid={submitted && !!nameProblem}
            aria-describedby={`${id}-name-msg`}
            onChange={(e) => {
              const name = e.target.value;
              setDraft((d) => ({ ...d, name, slug: slugEdited ? d.slug : slugify(name) }));
            }}
          />
        </FormField>

        <FormField
          label="Workspace URL"
          htmlFor={`${id}-slug`}
          required
          error={slugError ?? undefined}
          hint={slugError ? undefined : "Lowercase letters, numbers and dashes"}
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-crm-subtle">{domain}</span>
            <div className="relative flex-1">
              <Input
                id={`${id}-slug`}
                value={draft.slug}
                spellCheck={false}
                autoCapitalize="none"
                invalid={!!slugError}
                aria-describedby={`${id}-slug-msg ${id}-avail`}
                className="pr-8"
                onChange={(e) => {
                  setSlugEdited(true);
                  setDraft((d) => ({
                    ...d,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  }));
                }}
                onBlur={() => setDraft((d) => ({ ...d, slug: slugify(d.slug) }))}
              />
              <span
                id={`${id}-avail`}
                aria-live="polite"
                className="absolute top-1/2 right-2.5 -translate-y-1/2"
              >
                {availability === "checking" ? (
                  <Loader2
                    className="size-3.5 animate-spin text-crm-subtle"
                    aria-label="Checking"
                  />
                ) : availability === "available" ? (
                  <Check className="size-3.5 text-crm-success" aria-label="Available" />
                ) : availability === "taken" || availability === "reserved" ? (
                  <X className="size-3.5 text-crm-danger" aria-label="Unavailable" />
                ) : null}
              </span>
            </div>
          </div>
        </FormField>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-crm-soft" id={`${id}-size`}>
            Team size
          </span>
          <SegmentedControl
            label="Team size"
            fullWidth
            options={teamSizes}
            value={draft.teamSize}
            onValueChange={(teamSize) => setDraft((d) => ({ ...d, teamSize }))}
          />
        </div>

        <FormField
          label="Data region"
          htmlFor={`${id}-region`}
          hint="Where records are stored. Cannot be changed later."
        >
          <Select
            id={`${id}-region`}
            options={regions.map((r) => ({ ...r, icon: r.icon ?? <Globe className="size-3.5" /> }))}
            value={draft.region}
            onValueChange={(region) => setDraft((d) => ({ ...d, region }))}
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-crm-soft">Brand colour</span>
          <ColorSwatches
            aria-label="Brand colour"
            value={draft.color}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-crm bg-crm-danger/10 p-2.5 text-xs text-crm-danger">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="flex justify-end gap-2 border-t border-crm-border px-5 py-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          aria-disabled={!canSubmit || undefined}
        >
          Create workspace
        </Button>
      </footer>
    </form>
  );
}

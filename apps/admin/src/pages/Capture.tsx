import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Palette, ScanSearch, Wand2 } from "lucide-react";
import { api, CopyButton } from "@ti/client";
import { errorMessage, relativeTime } from "../types";
import { useLoad } from "../hooks/useLoad";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Table,
  TableSkeleton,
  Td,
  Th,
  THead,
  cn,
  focusRing,
  inputClass,
  useToast,
} from "../components/ui";

type Status = "queued" | "running" | "done" | "failed";
type Role = "bg" | "surface" | "text" | "mutedText" | "border" | "accent";

interface Step {
  value: number;
  count: number;
}
interface Tokens {
  palette: { hex: string; weight: number; uses: Record<"bg" | "text" | "border", number> }[];
  roles: Partial<Record<Role, string>>;
  fonts: { family: string; count: number }[];
  typeScale: { steps: Step[]; ratio: number | null };
  radii: Step[];
  spacing: { steps: Step[]; base: number | null };
  shadows: { value: string; count: number }[];
}
interface Row {
  id: string;
  url: string;
  title?: string;
  status: Status;
  error?: string;
  createdAt: string;
}
interface Detail extends Row {
  finalUrl?: string;
  tokens?: Tokens;
  inventory?: { kind: string; count: number; examples: string[] }[];
  screenshot?: string;
  themeCss?: string;
}

const STATUS_VARIANT = {
  queued: "neutral",
  running: "info",
  done: "success",
  failed: "danger",
} as const;

const ROLE_LABEL: Record<Role, string> = {
  bg: "Background",
  surface: "Surface",
  text: "Text",
  mutedText: "Muted text",
  border: "Border",
  accent: "Accent",
};

const StatusPill = ({ status }: { status: Status }) => (
  <Badge variant={STATUS_VARIANT[status]} dot>
    {status}
  </Badge>
);

/** Capture Engine: public URL -> design tokens + component inventory -> Theme draft. */
export function Capture() {
  const { id } = useParams();
  return id ? <CaptureDetail id={id} /> : <CaptureHome />;
}

function CaptureHome() {
  const navigate = useNavigate();
  const toast = useToast();
  const list = useLoad(() => api<Row[]>("/api/admin/captures"));
  const [url, setUrl] = useState("");
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/admin/captures", {
        method: "POST",
        json: { url, permission },
      });
      toast.success("Capture queued", "This usually takes 10-30 seconds.");
      navigate(`/capture/${r.id}`);
    } catch (err) {
      setError(errorMessage(err, "Could not start the capture"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Capture"
        description="Paste a public URL to extract its design tokens (palette, type, radius, spacing, shadows) and a component inventory, then turn them into a Kitbase theme."
      />
      <Card className="mb-6 p-4 sm:p-5">
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <label htmlFor="capture-url" className="text-sm font-medium text-foreground">
            Website URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="capture-url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://your-site.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
            />
            <Button
              type="submit"
              variant="primary"
              icon={ScanSearch}
              loading={busy}
              disabled={!permission || !url.trim()}
            >
              Capture
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={permission}
              onChange={(e) => setPermission(e.target.checked)}
              className={cn("mt-0.5 size-4 rounded", focusRing)}
            />
            I own or have permission to analyse this site.
          </label>
          <p className="text-xs text-muted-foreground">
            Only public http(s) pages. Private networks, localhost and cloud metadata addresses are
            blocked. Tokens are for building your own theme, not for copying someone else's brand.
          </p>
          {error ? <Alert title="Capture not started">{error}</Alert> : null}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Recent captures" description="Newest first, last 50." />
        {list.loading && !list.data ? (
          <TableSkeleton rows={3} cols={3} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={() => void list.reload()} />
        ) : !list.data?.length ? (
          <EmptyState
            icon={Palette}
            title="No captures yet"
            description="Run your first capture above."
          />
        ) : (
          <Table label="Captures">
            <THead>
              <tr>
                <Th>Site</Th>
                <Th>Status</Th>
                <Th>Started</Th>
              </tr>
            </THead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <Td>
                    <Link
                      to={`/capture/${row.id}`}
                      className={cn("font-medium text-foreground hover:underline", focusRing)}
                    >
                      {row.title || new URL(row.url).host}
                    </Link>
                    <p className="max-w-md truncate text-xs text-muted-foreground">{row.url}</p>
                  </Td>
                  <Td>
                    <StatusPill status={row.status} />
                  </Td>
                  <Td className="text-muted-foreground">{relativeTime(row.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function CaptureDetail({ id }: { id: string }) {
  const toast = useToast();
  const cap = useLoad(() => api<Detail>(`/api/admin/captures/${id}`), id);
  const [css, setCss] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const status = cap.data?.status;

  // Poll every 2s while the job is queued or running.
  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = window.setInterval(() => {
      api<Detail>(`/api/admin/captures/${id}`)
        .then(cap.setData)
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(t);
  }, [id, status, cap.setData]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api<{ css: string }>(`/api/admin/captures/${id}/theme`, { method: "POST" });
      setCss(r.css);
      toast.success("Theme draft saved");
    } catch (e) {
      toast.error("Could not generate theme", errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const back = (
    <Link to="/capture" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="size-4" aria-hidden /> All captures
    </Link>
  );
  if (cap.error)
    return (
      <>
        {back}
        <Card className="mt-4">
          <ErrorState message={cap.error} onRetry={() => void cap.reload()} />
        </Card>
      </>
    );
  const d = cap.data;
  if (!d) return <TableSkeleton rows={4} cols={2} />;
  const themeCss = css ?? d.themeCss ?? null;
  const t = d.tokens;

  return (
    <>
      {back}
      <div className="mt-3">
        <PageHeader
          title={d.title || new URL(d.url).host}
          description={d.finalUrl ?? d.url}
          meta={<StatusPill status={d.status} />}
          actions={
            d.status === "done" ? (
              <Button
                variant="primary"
                icon={Wand2}
                loading={generating}
                onClick={() => void generate()}
              >
                Generate theme CSS
              </Button>
            ) : null
          }
        />
      </div>
      {d.status === "failed" ? (
        <Alert title="Capture failed">{d.error ?? "Unknown error."}</Alert>
      ) : d.status !== "done" ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">
          {d.status === "queued"
            ? "Waiting for a free browser..."
            : "Loading the page and reading styles..."}
        </Card>
      ) : t ? (
        <div className="grid gap-6">
          {themeCss ? (
            <Card className="overflow-hidden">
              <CardHeader
                title="Theme CSS"
                description="Import after crm-theme.css to restyle every Kitbase component."
                actions={<CopyButton getText={() => themeCss}>Copy</CopyButton>}
              />
              <pre className="max-h-80 overflow-auto p-4 text-xs leading-relaxed">{themeCss}</pre>
            </Card>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Screenshot" description="First viewport, 1280x800." />
              {d.screenshot ? (
                <img src={d.screenshot} alt={`Screenshot of ${d.url}`} className="w-full" />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No screenshot.</p>
              )}
            </Card>
            <Card className="overflow-hidden">
              <CardHeader
                title="Roles"
                description="Best guesses from where each colour is used."
              />
              <ul className="grid grid-cols-2 gap-3 p-4">
                {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                  <li key={role} className="flex items-center gap-2 text-sm">
                    <Swatch hex={t.roles[role]} />
                    <span className="text-foreground">{ROLE_LABEL[role]}</span>
                    <code className="ml-auto text-xs text-muted-foreground">
                      {t.roles[role] ?? "-"}
                    </code>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Palette" description="Clustered colours, heaviest first." />
            <ul className="flex flex-wrap gap-3 p-4">
              {t.palette.map((c) => (
                <li key={c.hex} className="flex w-24 flex-col gap-1 text-xs">
                  <span
                    className="h-12 rounded-md ring-1 ring-border"
                    style={{ background: c.hex }}
                  />
                  <code className="text-foreground">{c.hex}</code>
                  <span className="text-muted-foreground">
                    {(["bg", "text", "border"] as const).filter((u) => c.uses[u] > 0).join(" / ")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader
                title="Type scale"
                description={[
                  t.fonts.map((f) => f.family).join(", ") || "No fonts found",
                  t.typeScale.ratio ? `ratio ~${t.typeScale.ratio}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <ul className="flex flex-col gap-2 p-4">
                {t.typeScale.steps.map((s) => (
                  <li key={s.value} className="flex items-baseline gap-3">
                    <code className="w-14 shrink-0 text-xs text-muted-foreground">{s.value}px</code>
                    <span
                      className="truncate text-foreground"
                      style={{ fontSize: s.value, fontFamily: t.fonts[0]?.family }}
                    >
                      The quick brown fox
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader
                title="Radius, spacing, shadows"
                description={
                  t.spacing.base ? `Spacing grid: ${t.spacing.base}px` : "No clear spacing grid"
                }
              />
              <div className="flex flex-col gap-4 p-4 text-xs">
                <ScaleRow
                  label="Radius"
                  steps={t.radii}
                  render={(v) => (
                    <span
                      className="size-8 border border-foreground/40 bg-muted"
                      style={{ borderRadius: v }}
                    />
                  )}
                />
                <ScaleRow
                  label="Spacing"
                  steps={t.spacing.steps}
                  render={(v) => (
                    <span className="h-3 bg-primary/70" style={{ width: Math.min(v, 96) }} />
                  )}
                />
                <ul className="flex flex-wrap gap-4">
                  {t.shadows.map((s) => (
                    <li
                      key={s.value}
                      className="size-14 rounded-md bg-background"
                      style={{ boxShadow: s.value }}
                      title={s.value}
                    />
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Component inventory"
              description="Visible elements matched on the page."
            />
            <Table label="Component inventory" className="min-w-[520px]">
              <THead>
                <tr>
                  <Th>Kind</Th>
                  <Th>Count</Th>
                  <Th>Example selectors</Th>
                </tr>
              </THead>
              <tbody>
                {(d.inventory ?? []).map((row) => (
                  <tr key={row.kind} className="border-b border-border last:border-0">
                    <Td className="font-medium capitalize text-foreground">{row.kind}</Td>
                    <Td>{row.count}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {row.examples.map((ex) => (
                          <code key={ex} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {ex}
                          </code>
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Swatch({ hex }: { hex?: string }) {
  return (
    <span
      className="size-6 shrink-0 rounded-md ring-1 ring-border"
      style={{ background: hex ?? "transparent" }}
      aria-hidden
    />
  );
}

function ScaleRow({
  label,
  steps,
  render,
}: {
  label: string;
  steps: Step[];
  render: (v: number) => ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-medium text-foreground">{label}</p>
      {steps.length ? (
        <ul className="flex flex-wrap items-end gap-3">
          {steps.map((s) => (
            <li key={s.value} className="flex flex-col items-center gap-1">
              {render(s.value)}
              <code className="text-muted-foreground">{s.value}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None detected.</p>
      )}
    </div>
  );
}

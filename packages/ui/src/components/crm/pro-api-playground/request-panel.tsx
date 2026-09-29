import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Plus, Trash2 } from "lucide-react";
import type {
  ApiOperation,
  ApiParameter,
  SecurityScheme,
} from "@/components/crm/pro-api-playground/openapi";
import { JsonBodyEditor } from "@/components/crm/pro-api-playground/json-editor";
import {
  kvId,
  type AuthValues,
  type KeyValue,
  type RequestDraft,
} from "@/components/crm/pro-api-playground/request";
import { cn } from "@/lib/utils";

const field =
  "h-8 w-full rounded-crm border border-crm-input bg-crm-bg px-2 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus:border-crm-ring disabled:opacity-50";
const tabCls =
  "rounded-crm px-2.5 py-1 text-xs text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-1 focus-visible:ring-crm-ring data-[state=active]:bg-crm-muted data-[state=active]:text-crm-fg";

function ParamRow({
  p,
  value,
  onChange,
  disabled,
}: {
  p: ApiParameter;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  const type = Array.isArray(p.schema.type)
    ? p.schema.type.join(" | ")
    : (p.schema.type ?? "string");
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 py-2">
      <label htmlFor={id} className="min-w-0">
        <span className={cn("font-mono text-xs text-crm-fg", p.deprecated && "line-through")}>
          {p.name}
        </span>
        {p.required && (
          <span className="ml-1 text-crm-danger" aria-label="required">
            *
          </span>
        )}
        <span className="ml-2 text-[10px] text-crm-muted-fg">
          {type}
          {p.schema.format ? ` · ${p.schema.format}` : ""}
        </span>
        {p.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-crm-muted-fg">{p.description}</p>
        )}
      </label>
      {Array.isArray(p.schema.enum) ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={field}
        >
          {!p.required && <option value="">—</option>}
          {p.schema.enum.map((o) => (
            <option key={String(o)} value={String(o)}>
              {String(o)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={p.required}
          aria-invalid={p.required && !value.trim() ? true : undefined}
          placeholder={p.schema.default !== undefined ? String(p.schema.default) : type}
          className={cn(field, "font-mono")}
        />
      )}
    </div>
  );
}

function HeaderEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  disabled?: boolean;
}) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => update(r.id, { enabled: e.target.checked })}
            aria-label={`Send header ${i + 1}`}
            disabled={disabled}
            className="accent-crm-primary"
          />
          <input
            value={r.key}
            onChange={(e) => update(r.id, { key: e.target.value })}
            placeholder="Header"
            aria-label={`Header ${i + 1} name`}
            disabled={disabled}
            className={cn(field, "font-mono")}
          />
          <input
            value={r.value}
            onChange={(e) => update(r.id, { value: e.target.value })}
            placeholder="Value"
            aria-label={`Header ${i + 1} value`}
            disabled={disabled}
            className={cn(field, "font-mono")}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
            aria-label={`Remove header ${r.key || i + 1}`}
            disabled={disabled}
            className="rounded-crm p-1.5 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-danger"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, { id: kvId(), key: "", value: "", enabled: true }])}
        className="flex items-center gap-1 rounded-crm px-2 py-1 text-xs text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
      >
        <Plus className="size-3.5" aria-hidden /> Add header
      </button>
    </div>
  );
}

function AuthEditor({
  schemes,
  required,
  auth,
  onChange,
  disabled,
}: {
  schemes: SecurityScheme[];
  required: string[];
  auth: AuthValues;
  onChange: (a: AuthValues) => void;
  disabled?: boolean;
}) {
  const scheme = schemes.find((s) => s.id === auth.scheme);
  const set = (patch: Partial<AuthValues>) => onChange({ ...auth, ...patch });
  return (
    <div className="space-y-3">
      <label className="block text-xs text-crm-muted-fg">
        Scheme
        <select
          value={auth.scheme}
          onChange={(e) => set({ scheme: e.target.value })}
          disabled={disabled}
          className={cn(field, "mt-1")}
        >
          <option value="none">No auth</option>
          {schemes.map((s) => (
            <option key={s.id} value={s.id} disabled={s.type === "unsupported"}>
              {s.id} ({s.type === "apiKey" ? `API key in ${s.in}` : s.type})
              {required.includes(s.id) ? " · required" : ""}
            </option>
          ))}
        </select>
      </label>
      {required.length > 0 && !required.includes(auth.scheme) && (
        <p className="text-xs text-crm-warning">This endpoint expects {required.join(" or ")}.</p>
      )}
      {scheme?.description && <p className="text-xs text-crm-muted-fg">{scheme.description}</p>}
      {scheme?.type === "bearer" && (
        <label className="block text-xs text-crm-muted-fg">
          Token{scheme.bearerFormat ? ` (${scheme.bearerFormat})` : ""}
          <input
            type="password"
            autoComplete="off"
            value={auth.token}
            onChange={(e) => set({ token: e.target.value })}
            disabled={disabled}
            className={cn(field, "mt-1 font-mono")}
          />
        </label>
      )}
      {scheme?.type === "basic" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-crm-muted-fg">
            Username
            <input
              autoComplete="off"
              value={auth.username}
              onChange={(e) => set({ username: e.target.value })}
              disabled={disabled}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="block text-xs text-crm-muted-fg">
            Password
            <input
              type="password"
              autoComplete="off"
              value={auth.password}
              onChange={(e) => set({ password: e.target.value })}
              disabled={disabled}
              className={cn(field, "mt-1")}
            />
          </label>
        </div>
      )}
      {scheme?.type === "apiKey" && (
        <label className="block text-xs text-crm-muted-fg">
          {scheme.name} ({scheme.in})
          <input
            type="password"
            autoComplete="off"
            value={auth.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            disabled={disabled}
            className={cn(field, "mt-1 font-mono")}
          />
        </label>
      )}
      <p className="text-[11px] text-crm-muted-fg">
        Credentials stay in memory and are redacted from snippets and history.
      </p>
    </div>
  );
}

export interface RequestPanelProps {
  op: ApiOperation;
  draft: RequestDraft;
  onDraftChange: (d: RequestDraft) => void;
  auth: AuthValues;
  onAuthChange: (a: AuthValues) => void;
  schemes: SecurityScheme[];
  disabled?: boolean;
}

export function RequestPanel({
  op,
  draft,
  onDraftChange,
  auth,
  onAuthChange,
  schemes,
  disabled,
}: RequestPanelProps) {
  const groups = (["path", "query", "header"] as const)
    .map((loc) => ({ loc, params: op.parameters.filter((p) => p.in === loc) }))
    .filter((g) => g.params.length);
  const paramCount = op.parameters.filter((p) => p.in !== "cookie").length;
  const defaultTab = op.requestBody ? "body" : paramCount ? "params" : "headers";
  const setParam = (key: string, v: string) =>
    onDraftChange({ ...draft, params: { ...draft.params, [key]: v } });

  return (
    <Tabs.Root key={op.id} defaultValue={defaultTab} className="flex h-full min-h-0 flex-col">
      <Tabs.List
        aria-label="Request sections"
        className="flex gap-1 border-b border-crm-border px-3 py-1.5"
      >
        <Tabs.Trigger value="params" className={tabCls}>
          Params {paramCount > 0 && <span className="text-crm-muted-fg">({paramCount})</span>}
        </Tabs.Trigger>
        <Tabs.Trigger value="auth" className={tabCls}>
          Auth
        </Tabs.Trigger>
        <Tabs.Trigger value="headers" className={tabCls}>
          Headers{" "}
          {draft.headers.length > 0 && (
            <span className="text-crm-muted-fg">({draft.headers.length})</span>
          )}
        </Tabs.Trigger>
        {op.requestBody && (
          <Tabs.Trigger value="body" className={tabCls}>
            Body
          </Tabs.Trigger>
        )}
      </Tabs.List>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <Tabs.Content value="params" className="outline-none">
          {groups.length === 0 && (
            <p className="text-sm text-crm-muted-fg">This endpoint takes no parameters.</p>
          )}
          {groups.map((g) => (
            <fieldset key={g.loc} className="mb-3">
              <legend className="text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg">
                {g.loc} parameters
              </legend>
              <div className="divide-y divide-crm-border">
                {g.params.map((p) => (
                  <ParamRow
                    key={p.name}
                    p={p}
                    value={draft.params[`${p.in}:${p.name}`] ?? ""}
                    onChange={(v) => setParam(`${p.in}:${p.name}`, v)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </Tabs.Content>
        <Tabs.Content value="auth" className="outline-none">
          <AuthEditor
            schemes={schemes}
            required={op.security}
            auth={auth}
            onChange={onAuthChange}
            disabled={disabled}
          />
        </Tabs.Content>
        <Tabs.Content value="headers" className="outline-none">
          <HeaderEditor
            rows={draft.headers}
            onChange={(headers) => onDraftChange({ ...draft, headers })}
            disabled={disabled}
          />
        </Tabs.Content>
        {op.requestBody && (
          <Tabs.Content value="body" className="flex h-full min-h-0 flex-col outline-none">
            <p className="mb-2 text-xs text-crm-muted-fg">
              <code className="font-mono">{op.requestBody.contentType}</code>
              {op.requestBody.required ? " · required" : " · optional"}
            </p>
            <JsonBodyEditor
              value={draft.body}
              onChange={(body) => onDraftChange({ ...draft, body })}
              schema={op.requestBody.schema}
              readOnly={disabled}
              className="min-h-0 flex-1"
            />
          </Tabs.Content>
        )}
      </div>
    </Tabs.Root>
  );
}

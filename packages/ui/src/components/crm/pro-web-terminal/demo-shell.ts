import { format } from "date-fns";
import type { ShellFactory, ShellSession } from "@/components/crm/pro-web-terminal/types";

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const FILES = [
  "README.md",
  "package.json",
  "src/",
  "tests/",
  "infra/",
  ".env.example",
  "docker-compose.yml",
];
const COMMANDS = [
  "help",
  "ls",
  "pwd",
  "whoami",
  "date",
  "echo",
  "clear",
  "history",
  "git",
  "npm",
  "kubectl",
  "curl",
  "deploy",
  "exit",
];

/**
 * In-browser demo shell with line editing (arrows, history, Ctrl+C/L/U, tab completion) and a few
 * scripted commands that stream output. Replace with a WebSocket/PTY factory in production.
 */
export const createDemoShell =
  (opts: { user?: string; host?: string; cwd?: string } = {}): ShellFactory =>
  () => {
    const user = opts.user ?? "dev";
    const host = opts.host ?? "kitbase";
    const cwd = opts.cwd ?? "~/acme-api";
    const listeners = new Set<(d: string) => void>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const history: string[] = [];
    let line = "";
    let cursor = 0;
    let hIndex = -1;
    let busy = false;
    let cancel: (() => void) | null = null;

    const emit = (d: string) => listeners.forEach((l) => l(d));
    const prompt = () => emit(`${C.green}${user}@${host}${C.reset}:${C.blue}${cwd}${C.reset}$ `);
    const redraw = () => {
      emit(`\r\x1b[2K`);
      prompt();
      emit(line);
      const back = line.length - cursor;
      if (back > 0) emit(`\x1b[${back}D`);
    };

    /** Stream lines with delays; resolves to prompt unless cancelled. */
    const stream = (lines: [number, string][]) => {
      busy = true;
      let i = 0;
      let alive = true;
      cancel = () => {
        alive = false;
      };
      const step = () => {
        if (!alive) return;
        const next = lines[i++];
        if (!next) {
          busy = false;
          cancel = null;
          prompt();
          return;
        }
        emit(next[1] + "\r\n");
        const t = setTimeout(step, next[0]);
        timers.add(t);
      };
      step();
    };

    const run = (cmd: string) => {
      const [name = "", ...args] = cmd.trim().split(/\s+/);
      const out = (s: string) => emit(s.replace(/\n/g, "\r\n") + "\r\n");
      switch (name) {
        case "":
          return prompt();
        case "help":
          out(
            `${C.bold}Available commands${C.reset}\n  ${COMMANDS.join("  ")}\n${C.dim}Tip: Ctrl+Shift+P opens the command history palette.${C.reset}`,
          );
          return prompt();
        case "ls":
          out(FILES.map((f) => (f.endsWith("/") ? `${C.blue}${f}${C.reset}` : f)).join("  "));
          return prompt();
        case "pwd":
          out(`/home/${user}/acme-api`);
          return prompt();
        case "whoami":
          out(user);
          return prompt();
        case "date":
          out(format(new Date(), "EEE MMM d HH:mm:ss yyyy"));
          return prompt();
        case "echo":
          out(args.join(" "));
          return prompt();
        case "clear":
          emit("\x1b[2J\x1b[3J\x1b[H");
          return prompt();
        case "history":
          out(history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n"));
          return prompt();
        case "git":
          if (args[0] === "log")
            out(
              [
                `${C.yellow}a41c9e2${C.reset} (HEAD -> main) feat(billing): proration for mid-cycle upgrades`,
                `${C.yellow}9be01d7${C.reset} fix(auth): refresh token rotation race`,
                `${C.yellow}72f3a10${C.reset} chore(deps): bump pg to 8.13`,
              ].join("\n"),
            );
          else
            out(
              `On branch ${C.cyan}main${C.reset}\nChanges not staged for commit:\n  ${C.red}modified:   src/billing/invoice.ts${C.reset}\n  ${C.red}modified:   tests/invoice.test.ts${C.reset}`,
            );
          return prompt();
        case "npm":
          if (args[0] !== "test") {
            out(`${C.red}npm ERR!${C.reset} try: npm test`);
            return prompt();
          }
          return stream([
            [120, `${C.dim}> acme-api@2.14.0 test${C.reset}`],
            [260, `${C.dim}> vitest run${C.reset}`],
            [200, ""],
            ...[
              "auth/session",
              "billing/invoice",
              "billing/proration",
              "webhooks/stripe",
              "usage/meter",
            ].map((t, i): [number, string] => [
              180 + i * 60,
              ` ${C.green}✓${C.reset} tests/${t}.test.ts ${C.dim}(${12 + i * 7} tests) ${40 + i * 23}ms${C.reset}`,
            ]),
            [100, ""],
            [50, ` ${C.bold}Test Files${C.reset}  ${C.green}5 passed${C.reset} (5)`],
            [50, `      ${C.bold}Tests${C.reset}  ${C.green}95 passed${C.reset} (95)`],
          ]);
        case "kubectl":
          out(
            `NAME                        READY   STATUS    RESTARTS   AGE\napi-7d9f8c6b5-2xkqp         1/1     ${C.green}Running${C.reset}   0          3d\nworker-5c7b9d4f8-lm2vn      1/1     ${C.green}Running${C.reset}   2          3d\nscheduler-6f8d7c9b4-p8zqr   0/1     ${C.yellow}Pending${C.reset}   0          12m`,
          );
          return prompt();
        case "curl":
          out(
            `{\n  "status": "ok",\n  "version": "2.14.0",\n  "uptime_s": 271834,\n  "db": { "latency_ms": 3.2 }\n}`,
          );
          return prompt();
        case "deploy":
          return stream([
            [
              300,
              `${C.cyan}▸${C.reset} Building image acme-api:${Date.now().toString(36).slice(-6)}`,
            ],
            ...Array.from({ length: 10 }, (_, i): [number, string] => [
              140,
              `  [${"#".repeat(i + 1).padEnd(10, ".")}] ${(i + 1) * 10}%`,
            ]),
            [400, `${C.cyan}▸${C.reset} Rolling out to production (3 replicas)`],
            [600, `${C.green}✔${C.reset} Deployed in 7.4s`],
          ]);
        case "exit":
          out(`${C.dim}logout (demo shells stay open)${C.reset}`);
          return prompt();
        default:
          out(`${C.red}zsh: command not found:${C.reset} ${name}`);
          return prompt();
      }
    };

    emit(
      `${C.dim}Kitbase demo shell · type ${C.reset}${C.bold}help${C.reset}${C.dim} to get started${C.reset}\r\n`,
    );
    prompt();

    const session: ShellSession = {
      onOutput(l) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      write(data) {
        if (data === "\x03") {
          if (busy) {
            cancel?.();
            busy = false;
            cancel = null;
          }
          emit("^C\r\n");
          line = "";
          cursor = 0;
          return prompt();
        }
        if (busy) return;
        // Pasted multi-line text: run each complete line.
        if (data.length > 1 && /[\r\n]/.test(data) && !data.startsWith("\x1b")) {
          const parts = data.split(/\r\n|\r|\n/);
          parts.forEach((p, i) => {
            if (i < parts.length - 1) session.write(p + "\r");
            else if (p) session.write(p);
          });
          return;
        }
        switch (data) {
          case "\r": {
            emit("\r\n");
            const cmd = line;
            if (cmd.trim()) history.push(cmd);
            line = "";
            cursor = 0;
            hIndex = -1;
            return run(cmd);
          }
          case "\x7f":
            if (cursor > 0) {
              line = line.slice(0, cursor - 1) + line.slice(cursor);
              cursor--;
              redraw();
            }
            return;
          case "\x0c":
            emit("\x1b[2J\x1b[H");
            return redraw();
          case "\x15":
            line = "";
            cursor = 0;
            return redraw();
          case "\t": {
            const match = COMMANDS.filter((c) => c.startsWith(line));
            if (match.length === 1) {
              line = match[0] + " ";
              cursor = line.length;
              redraw();
            } else if (match.length > 1) {
              emit("\r\n" + match.join("  ") + "\r\n");
              redraw();
            }
            return;
          }
          case "\x1b[A":
          case "\x1b[B": {
            if (!history.length) return;
            const up = data === "\x1b[A";
            hIndex = up
              ? hIndex < 0
                ? history.length - 1
                : Math.max(0, hIndex - 1)
              : hIndex < 0
                ? -1
                : hIndex + 1;
            if (hIndex >= history.length) hIndex = -1;
            line = hIndex < 0 ? "" : (history[hIndex] ?? "");
            cursor = line.length;
            return redraw();
          }
          case "\x1b[D":
            if (cursor > 0) {
              cursor--;
              emit(data);
            }
            return;
          case "\x1b[C":
            if (cursor < line.length) {
              cursor++;
              emit(data);
            }
            return;
          case "\x1b[H":
            cursor = 0;
            return redraw();
          case "\x1b[F":
            cursor = line.length;
            return redraw();
        }
        if (data.startsWith("\x1b")) return;
        const printable = [...data].filter((ch) => ch.charCodeAt(0) >= 32).join("");
        if (!printable) return;
        line = line.slice(0, cursor) + printable + line.slice(cursor);
        cursor += printable.length;
        if (cursor === line.length) emit(printable);
        else redraw();
      },
      dispose() {
        timers.forEach(clearTimeout);
        listeners.clear();
      },
    };
    return session;
  };

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "chatgpt-usage-status";
const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");
const USAGE_URL = "https://chatgpt.com/backend-api/codex/usage";

interface UsageWindow {
  used_percent: number;
  reset_at: number;
}

interface UsageResponse {
  rate_limit?: {
    primary_window?: UsageWindow | null;
    secondary_window?: UsageWindow | null;
  };
}

interface PiContext {
  ui: { setStatus(key: string, value: string | undefined): void };
  model?: { provider?: string };
}

function readAuth(): { access: string; accountId: string } | undefined {
  try {
    const cred = JSON.parse(readFileSync(AUTH_PATH, "utf8"))["openai-codex"];
    if (cred?.access && cred?.accountId) return { access: cred.access, accountId: cred.accountId };
  } catch {}
}

async function fetchUsage(): Promise<UsageResponse | undefined> {
  const auth = readAuth();
  if (!auth) return;

  try {
    const response = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${auth.access}`,
        "chatgpt-account-id": auth.accountId,
        "User-Agent": "pi",
      },
    });
    if (response.ok) return (await response.json()) as UsageResponse;
  } catch {}
}

function formatDuration(ms: number): string {
  const minutes = Math.max(0, ms / 60_000);
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(2)}d`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(2)}h`;
  return `${minutes.toFixed(0)}min`;
}

function formatWindow(window: UsageWindow): string {
  const remaining = 100 - Math.max(0, Math.min(100, window.used_percent));
  return `${remaining.toFixed(0)}%,${formatDuration(window.reset_at * 1000 - Date.now())}`;
}

function formatStatus(usage: UsageResponse | undefined): string | undefined {
  const fiveHour = usage?.rate_limit?.primary_window;
  const weekly = usage?.rate_limit?.secondary_window;
  if (!fiveHour || !weekly) return undefined;
  return `5h(${formatWindow(fiveHour)}) Wk(${formatWindow(weekly)})`;
}

export default function chatGptUsageStatus(pi: ExtensionAPI) {
  let ctx: PiContext | undefined;
  let usage: UsageResponse | undefined;
  let fetchedAt = 0;
  let fetching = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const isCodex = () => ctx?.model?.provider === "openai-codex";

  const render = () => {
    ctx?.ui.setStatus(STATUS_KEY, isCodex() ? formatStatus(usage) : undefined);
  };

  const refresh = async () => {
    if (!isCodex() || fetching) return render();

    fetching = true;
    usage = await fetchUsage();
    fetchedAt = Date.now();
    fetching = false;
    render();
  };

  const tick = () => {
    render();
    if (isCodex() && Date.now() - fetchedAt > 60_000) void refresh();
  };

  pi.on("session_start", (_event, nextCtx) => {
    if (interval) clearInterval(interval);
    ctx = nextCtx;
    tick();
    interval = setInterval(tick, 1000);
  });

  pi.on("model_select", (_event, nextCtx) => {
    ctx = nextCtx;
    usage = undefined;
    fetchedAt = 0;
    tick();
  });

  pi.on("session_shutdown", (_event, shutdownCtx) => {
    if (interval) clearInterval(interval);
    interval = undefined;
    ctx = undefined;
    shutdownCtx.ui.setStatus(STATUS_KEY, undefined);
  });
}

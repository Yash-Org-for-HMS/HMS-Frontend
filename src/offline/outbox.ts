import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { idbAll, idbDelete, idbPut, STORES } from "./idb";
import { offlineSave } from "./offlineScope";
import { currentUserId } from "./readCache";
import { isNetworkFailure, setOfflineState } from "./offlineState";

/**
 * Saves made with no network, waiting on this computer.
 *
 * A save on a "works offline" screen that cannot reach the server is kept here
 * with its Idempotency-Key, the user and branch it was made as, and when -
 * then sent, in the order made, as soon as the network is back (and every 20 s
 * while anything waits). The server checks every rule on arrival; the key
 * makes a resend of a save that did get through harmless.
 *
 * Sent only as the user who made it, so the audit trail names the right
 * person: another user's saves wait until they sign in on this computer.
 * One the server refuses (the bed was taken, the stock ran out) goes to the
 * "needs attention" tray - never dropped quietly.
 */
export interface QueuedSave {
  /** The Idempotency-Key: the save's identity, on every attempt. */
  id: string;
  userId: string;
  branchId: string | null;
  method: string;
  url: string;
  /** The JSON body, as sent. */
  data: string | null;
  label: string;
  queuedAt: number;
  state: "WAITING" | "FAILED";
  error?: string;
}

export const QUEUED_MESSAGE = "No network - saved on this computer. It will be sent when the network is back.";

type Sender = (s: QueuedSave) => Promise<AxiosResponse>;
let sender: Sender | null = null;
/** The request layer hands over how to send (api/axios.ts), so this file does not import it. */
export function setSender(fn: Sender): void {
  sender = fn;
}

/** Keep a save that could not be sent; answer the screen as if accepted, marked `queued`. */
export async function queueSave(config: InternalAxiosRequestConfig): Promise<AxiosResponse | null> {
  const what = offlineSave(config.method, config.url);
  const userId = currentUserId();
  const id = config.headers?.["Idempotency-Key"] as string | undefined;
  if (!what || !userId || !id) return null;
  const saved: QueuedSave = {
    id, userId, branchId: (config.headers?.["X-Branch-Id"] as string | undefined) ?? null,
    method: (config.method ?? "post").toLowerCase(), url: config.url!,
    data: typeof config.data === "string" ? config.data : config.data == null ? null : JSON.stringify(config.data),
    label: what.label, queuedAt: Date.now(), state: "WAITING",
  };
  if ((await idbPut(STORES.outbox, saved)) === null) return null; // storage blocked: let the save fail as before
  await countSaves();
  window.dispatchEvent(new CustomEvent("offline-queued", { detail: { label: what.label } }));
  return {
    status: 202, statusText: "Queued", headers: {}, config,
    data: { success: true, queued: true, message: QUEUED_MESSAGE, data: {} },
  } as AxiosResponse;
}

/** This user's saves on this computer: waiting, and refused. */
export async function mySaves(): Promise<QueuedSave[]> {
  const userId = currentUserId();
  return (await idbAll<QueuedSave>(STORES.outbox)).filter((s) => s.userId === userId).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function countSaves(): Promise<void> {
  const mine = await mySaves();
  setOfflineState({ waiting: mine.filter((s) => s.state === "WAITING").length, failed: mine.filter((s) => s.state === "FAILED").length });
}

let sending = false;

/** Send what waits, in order. Stops at the first network failure; a refusal goes to the tray. */
export async function sendWaiting(): Promise<void> {
  if (sending || !sender || !currentUserId()) return;
  sending = true;
  const waiting = (await mySaves()).filter((x) => x.state === "WAITING");
  if (!waiting.length) { sending = false; return; }
  setOfflineState({ syncing: true });
  let sent = 0;
  try {
    for (const s of waiting) {
      try {
        await sender(s);
        await idbDelete(STORES.outbox, s.id);
        sent++;
      } catch (err) {
        const e = err as { response?: { status?: number; headers?: Record<string, string>; data?: { message?: string } } };
        const status = e.response?.status ?? 0;
        // No network, a server error, signed out, or the first copy still running: try again later.
        if (isNetworkFailure(err) || status >= 500 || status === 401 || e.response?.headers?.["idempotent-pending"]) break;
        await idbPut(STORES.outbox, { ...s, state: "FAILED", error: e.response?.data?.message ?? `Refused (${status})` } satisfies QueuedSave);
      }
    }
  } finally {
    sending = false;
    setOfflineState({ syncing: false });
    await countSaves();
    if (sent) window.dispatchEvent(new CustomEvent("offline-synced", { detail: { count: sent } }));
  }
}

/** The tray: send a refused one again (after fixing what was wrong), or let it go. */
export async function retrySave(s: QueuedSave): Promise<void> {
  await idbPut(STORES.outbox, { ...s, state: "WAITING", error: undefined } satisfies QueuedSave);
  await sendWaiting();
}
export async function discardSave(id: string): Promise<void> {
  await idbDelete(STORES.outbox, id);
  await countSaves();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void sendWaiting());
  // While anything waits, keep trying: "online" does not fire when only the internet (not the Wi-Fi) came back.
  window.setInterval(() => { void countSaves().then(() => sendWaiting()); }, 20_000);
}

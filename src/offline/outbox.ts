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
 *
 * The server keeps a save's key for 30 days (middleware/idempotency.ts KEEP_DAYS);
 * after that a resend would run again. So a save is sent by itself for
 * SEND_FOR_DAYS, then goes to the tray for a person to check (it is dated the
 * day it was made); from the tray it can be sent until LAST_SEND_DAYS, well
 * inside the server's 30. Tabs share this queue: one sends at a time (a lock).
 */
const DAY_MS = 86_400_000;
const SEND_FOR_DAYS = 7;
const LAST_SEND_DAYS = 25;

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
  /** Sent again from the tray by a person: the SEND_FOR_DAYS limit no longer holds it back. */
  confirmed?: boolean;
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
  // Another tab of this computer may be sending the same queue: one at a time.
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) await locks.request("hms-outbox", { ifAvailable: true }, (lock) => (lock ? sendNow() : undefined));
  else await sendNow();
}

async function sendNow(): Promise<void> {
  if (sending || !sender) return;
  sending = true;
  const waiting = (await mySaves()).filter((x) => x.state === "WAITING");
  if (!waiting.length) { sending = false; return; }
  setOfflineState({ syncing: true });
  let sent = 0;
  try {
    for (const s of waiting) {
      // Waited too long to send by itself: a person checks it was not entered another way.
      if (!s.confirmed && Date.now() - s.queuedAt > SEND_FOR_DAYS * DAY_MS) {
        await idbPut(STORES.outbox, { ...s, state: "FAILED", error: `Not sent for over ${SEND_FOR_DAYS} days - check it was not entered another way, then send it again or remove it` } satisfies QueuedSave);
        continue;
      }
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
  // Past this the server may have forgotten the save, and a resend could record it twice.
  if (Date.now() - s.queuedAt > LAST_SEND_DAYS * DAY_MS) {
    await idbPut(STORES.outbox, { ...s, state: "FAILED", error: `Too old to send safely (over ${LAST_SEND_DAYS} days) - check whether it was recorded; if not, enter it again and remove this one` } satisfies QueuedSave);
    await countSaves();
    return;
  }
  await idbPut(STORES.outbox, { ...s, state: "WAITING", error: undefined, confirmed: true } satisfies QueuedSave);
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

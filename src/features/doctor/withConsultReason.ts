import axios from "axios";
import type { useAskReason } from "@/providers/ConfirmContext";

/** Thrown when the doctor cancels the reason prompt: the save did not happen. */
export class ReasonCancelled extends Error {
  constructor() { super("Cancelled"); }
}

/**
 * Run a save; if the server answers that a reason is needed - the doctor is
 * covering a colleague's visit, or amending one already completed - ask for it
 * and run the save again with it. Cancelling the prompt throws ReasonCancelled.
 */
export async function withConsultReason<T>(
  askReason: ReturnType<typeof useAskReason>,
  call: (reason?: string) => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    const body = axios.isAxiosError(err) ? err.response?.data : null;
    if (body?.code !== "CONSULT_REASON_REQUIRED") throw err;
    const reason = await askReason({ title: "Reason needed", message: body.message, label: "Reason", confirmText: "Save" });
    if (!reason) throw new ReasonCancelled();
    return await call(reason);
  }
}

import type { ChipProps } from "@mui/material";

type MuiColor = ChipProps["color"];

// Client-side status → MUI colour maps. Previously duplicated as local
// `getStatusColor` functions in the lab/radiology queues and the trials list.
// (Server-driven statuses that ship their own hex colour use <StatusChip>.)

/** MUI Chip colour for a lab / radiology order status. */
export function orderStatusColor(status: string): MuiColor {
  switch (status) {
    case "COMPLETED": return "success";
    case "SAMPLE_COLLECTED": return "info";
    case "IN_PROGRESS": return "warning";
    case "PENDING": return "default";
    default: return "default";
  }
}

/** A lab / radiology order status in words ("Sample collected", not SAMPLE_COLLECTED). */
export function orderStatusLabel(status: string | null | undefined): string {
  const s = (status || "PENDING").toUpperCase();
  const words: Record<string, string> = { PENDING: "Pending", SAMPLE_COLLECTED: "Sample collected", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return words[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

/** MUI Chip colour for an invoice / order payment status (PaymentState). */
export function paymentStatusColor(status: string): MuiColor {
  switch (status) {
    case "PAID": return "success";
    case "PARTIAL": return "warning";
    case "UNPAID": return "warning";
    case "BILLED": return "info";
    case "REFUNDED": return "secondary";
    default: return "default";
  }
}

/** MUI Chip colour for a trial lifecycle status. */
export function trialStatusColor(status: string): MuiColor {
  switch (status) {
    case "active": return "primary";
    case "expired": return "error";
    case "converted": return "success";
    default: return "default";
  }
}

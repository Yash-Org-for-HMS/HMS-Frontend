// Presentation metadata for claim statuses / enums — shared across the claims
// list, detail, and form so labels and colors stay consistent.

export const CLAIM_STATUS_META: Record<string, { label: string; color: string }> = {
  REGISTERED: { label: "Registered", color: "#64748b" },
  PREAUTH_SUBMITTED: { label: "Pre-auth Submitted", color: "#f59e0b" },
  PREAUTH_QUERIED: { label: "Pre-auth Queried", color: "#f97316" },
  PREAUTH_APPROVED: { label: "Pre-auth Approved", color: "#3b82f6" },
  PREAUTH_REJECTED: { label: "Pre-auth Rejected", color: "#ef4444" },
  IN_TREATMENT: { label: "In Treatment", color: "#8b5cf6" },
  CLAIM_SUBMITTED: { label: "Claim Submitted", color: "#0891b2" },
  CLAIM_QUERIED: { label: "Claim Queried", color: "#f97316" },
  SETTLED: { label: "Settled", color: "#10b981" },
  PARTIALLY_SETTLED: { label: "Partially Settled", color: "#14b8a6" },
  REJECTED: { label: "Rejected", color: "#ef4444" },
  CLOSED: { label: "Closed", color: "#475569" },
};

export const statusMeta = (s: string) => CLAIM_STATUS_META[s] || { label: s, color: "#64748b" };

export const SCHEME_OPTIONS = [
  { value: "INSURANCE", label: "Private Insurance" },
  { value: "MAA", label: "MAA Card" },
  { value: "PMJAY", label: "Ayushman Bharat (PMJAY)" },
  { value: "OTHER", label: "Other" },
];

export const PAYER_TYPE_OPTIONS = [
  { value: "TPA", label: "TPA" },
  { value: "PRIVATE_INSURER", label: "Private Insurer" },
  { value: "GOVT_SCHEME", label: "Government Scheme" },
];

export const RELATION_OPTIONS = ["Self", "Spouse", "Child", "Parent", "Other"];

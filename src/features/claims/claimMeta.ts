import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
// Presentation metadata for claim statuses / enums — shared across the claims
// list, detail, and form so labels and colors stay consistent.

export const CLAIM_STATUS_META: Record<string, { label: string; color: string }> = {
  REGISTERED: { label: "Registered", color: NEUTRAL.muted },
  PREAUTH_SUBMITTED: { label: "Pre-auth Submitted", color: SEMANTIC.warning },
  PREAUTH_QUERIED: { label: "Pre-auth Queried", color: "#f97316" },
  PREAUTH_APPROVED: { label: "Pre-auth Approved", color: SEMANTIC.info },
  PREAUTH_REJECTED: { label: "Pre-auth Rejected", color: SEMANTIC.danger },
  IN_TREATMENT: { label: "In Treatment", color: "#8b5cf6" },
  CLAIM_SUBMITTED: { label: "Claim Submitted", color: ACCENTS.reception },
  CLAIM_QUERIED: { label: "Claim Queried", color: "#f97316" },
  SETTLED: { label: "Settled", color: SEMANTIC.success },
  PARTIALLY_SETTLED: { label: "Partially Settled", color: "#14b8a6" },
  REJECTED: { label: "Rejected", color: SEMANTIC.danger },
  CLOSED: { label: "Closed", color: NEUTRAL.textSecondary },
};

export const statusMeta = (s: string) => CLAIM_STATUS_META[s] || { label: s, color: NEUTRAL.muted };

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

// Document checklist — mirrors CLAIM_DOC_CATALOG in the backend
// (src/modules/claims/claims.constants.ts). Keep the two in sync.
export type DocStage = "PREAUTH" | "FINAL";
export const CLAIM_DOC_CATALOG: { code: string; label: string; stage: DocStage; required: boolean }[] = [
  { code: "AADHAAR", label: "Aadhaar Card", stage: "PREAUTH", required: true },
  { code: "PAN", label: "PAN Card", stage: "PREAUTH", required: false },
  { code: "POLICY", label: "Insurance Policy / Card", stage: "PREAUTH", required: true },
  { code: "PREAUTH_FORM", label: "Pre-authorization Form", stage: "PREAUTH", required: true },
  { code: "MEDICAL_REPORT", label: "Medical Reports", stage: "PREAUTH", required: false },
  { code: "FINAL_BILL", label: "Final Bill / Invoice", stage: "FINAL", required: true },
  { code: "DISCHARGE_SUMMARY", label: "Discharge Summary", stage: "FINAL", required: true },
  { code: "FINAL_REPORT", label: "Final Investigation Reports", stage: "FINAL", required: false },
  { code: "OTHER", label: "Other Supporting Document", stage: "PREAUTH", required: false },
];

export const DOC_STAGE_LABEL: Record<DocStage, string> = {
  PREAUTH: "Pre-authorization documents",
  FINAL: "Final claim documents",
};

export const docTypeLabel = (code: string) => CLAIM_DOC_CATALOG.find((d) => d.code === code)?.label || code;

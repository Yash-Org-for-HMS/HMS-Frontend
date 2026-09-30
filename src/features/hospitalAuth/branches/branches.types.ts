/** Shapes of GET /hospital/branches — a branch's own details and settings, and the hospital's they fall back to. */

export interface BranchSettings {
  vitalsCollector: "RECEPTIONIST" | "NURSE" | null;
  billingStrategy: "PRE_PAID" | "POST_PAID" | null;
  refundApprovalThreshold: string | number | null;
  opdStartTime: string | null;
  opdEndTime: string | null;
  opdSlotMinutes: number | null;
}

export interface BranchRow {
  branchId: string;
  branchCode: string;
  branchName: string;
  status: "active" | "inactive" | "suspended";
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  registrationNumber: string | null;
  logoUrl: string | null;
  licensedBeds: number | null;
  settings: BranchSettings | null;
}

export interface HospitalDefaults {
  hospitalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  officialPhone: string | null;
  officialEmail: string | null;
  gstNumber: string | null;
  registrationNumber: string | null;
  logoUrl: string | null;
  settings: {
    vitalsCollector: "RECEPTIONIST" | "NURSE";
    billingStrategy: "PRE_PAID" | "POST_PAID";
    refundApprovalThreshold: string | number;
    opdHours: { startTime: string; endTime: string; slotDurationMinutes: number };
  };
}

export interface BranchesResponse {
  hospital: HospitalDefaults;
  branches: BranchRow[];
}

export const VITALS_LABEL: Record<string, string> = { RECEPTIONIST: "Reception records vitals", NURSE: "A nurse records vitals" };
export const LAB_BILLING_LABEL: Record<string, string> = { PRE_PAID: "Lab tests paid before the test", POST_PAID: "Lab tests billed after the report" };

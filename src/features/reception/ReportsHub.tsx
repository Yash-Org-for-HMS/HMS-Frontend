import { useMemo } from "react";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { isAdmin as isAdminRole } from "@/constants/roles";
import {
  DailyOpd, Analytics, Collection, ReferralsByDoctor, OpRegistration, OpBills, DiagnosisWise, Census, OpdVisitRegister,
} from "./Reports";
import { InPatients, Discharges, IpRegistrations, IpAdvances, Occupancy, OverdueDoses } from "../ipd/IpdReports";
import { Outstanding, PatientStatement, Receipts, ServiceWise, PharmacyExpense, UnreturnedAdvances } from "../billing/BillingReports";
import { DayBook, RevenueAnalytics, RefundRegister, DiscountRegister, CancelledInvoices, DoctorProductivity } from "../billing/FinanceReports";
import { LabOverview, TestWise, Turnaround, Pending, CriticalResults, OrderRegister } from "../lab/LabReports";
import { PharmacyOverview } from "../pharmacy/PharmacyReports";
import { StockValuation, ExpiryLoss, PurchaseConsumption, ReorderList, SupplierLedger, Movers, OpdIpdSplit } from "../pharmacy/InventoryReports";
import { BRAND } from "@/styles/accents";
import { ReportNavLayout, type ReportItem } from "@/features/reports/kit";
import { NURSE_REPORT_GROUPS } from "../nurse/NurseReports";
import { CLAIM_REPORT_GROUPS } from "../claims/ClaimReports";

import OtReports, { type OtReportKey } from "@/features/ipd/OtReports";

/**
 * The theatre reports, one hub entry each.
 *
 * They lived on a page of their own at /ipd/ot-reports, so six reports were
 * invisible from the place people go to look for reports. Each mounts the same
 * component pinned to one report, which keeps its filters and drops its own
 * header and tab strip.
 */
const otReport = (key: OtReportKey) => () => <OtReports report={key} />;

const ACCENT = BRAND.action;

// Gating is this panel's own concern; the shared layout renders what it is given.
type ReportGroup = { heading: string; module?: string; adminOnly?: boolean; items: ReportItem[] };

// Single source of truth for the whole report catalogue, grouped by area.
const GROUPS: ReportGroup[] = [
  {
    heading: "OPD",
    items: [
      { key: "daily-opd", label: "Daily OPD Summary", Comp: DailyOpd },
      { key: "opd-visits", label: "OPD Visit Register (date-wise)", Comp: OpdVisitRegister },
      { key: "appointment-analytics", label: "Appointment Analytics", Comp: Analytics },
      { key: "op-registration", label: "OP Registration", Comp: OpRegistration },
      { key: "op-bills", label: "OP Bills", Comp: OpBills },
      { key: "diagnosis-wise", label: "Diagnosis-Wise", Comp: DiagnosisWise },
      { key: "referrals", label: "Referral Sources", Comp: ReferralsByDoctor },
    ],
  },
  {
    heading: "In-Patient (IPD)",
    module: "IPD",
    items: [
      { key: "ipd-census", label: "Ward Census & Occupancy", Comp: Census },
      { key: "ipd-occupancy", label: "Occupancy Trend & ALOS", Comp: Occupancy },
      { key: "ipd-overdue-doses", label: "Overdue Medication Doses", Comp: OverdueDoses },
      { key: "inpatient-list", label: "In-Patient List", Comp: InPatients },
      { key: "discharges", label: "Discharges", Comp: Discharges },
      { key: "ip-registrations", label: "IP Registrations", Comp: IpRegistrations },
      { key: "ip-advances", label: "IP Advances", Comp: IpAdvances },
    ],
  },
  {
    heading: "Operating Theatre",
    module: "IPD",
    items: [
      { key: "ot-utilisation", label: "Theatre Utilisation", Comp: otReport("utilisation") },
      { key: "ot-turnaround", label: "Turnaround Between Cases", Comp: otReport("turnaround") },
      { key: "ot-case-mix", label: "Case Mix", Comp: otReport("cases") },
      { key: "ot-cancellations", label: "Cancellations", Comp: otReport("cancellations") },
      { key: "ot-complications", label: "Complications", Comp: otReport("complications") },
      { key: "ot-revenue", label: "Theatre Revenue", Comp: otReport("revenue") },
    ],
  },
  {
    heading: "Billing & Finance",
    adminOnly: true,
    items: [
      { key: "day-book", label: "Day Book (Cash Book)", Comp: DayBook },
      { key: "collection", label: "Daily Collection", Comp: Collection },
      { key: "receipts", label: "Receipts", Comp: Receipts },
      { key: "outstanding", label: "Outstanding Dues", Comp: Outstanding },
      { key: "unreturned-advances", label: "Unreturned Advances (to refund)", Comp: UnreturnedAdvances },
      { key: "patient-statement", label: "Patient Account Statement", Comp: PatientStatement },
      { key: "revenue", label: "Revenue Analytics", Comp: RevenueAnalytics },
      { key: "service-wise", label: "Service-Wise Revenue", Comp: ServiceWise },
      { key: "doctor-productivity", label: "Doctor Productivity & Earnings", Comp: DoctorProductivity },
      { key: "pharmacy-expense", label: "Pharmacy Expense", Comp: PharmacyExpense },
      { key: "refund-register", label: "Refund Register", Comp: RefundRegister },
      { key: "discount-register", label: "Discount Register", Comp: DiscountRegister },
      { key: "cancelled-invoices", label: "Cancelled Invoices", Comp: CancelledInvoices },
    ],
  },
  {
    heading: "Laboratory",
    module: "Laboratory",
    adminOnly: true,
    items: [
      { key: "lab-reports", label: "Lab & Radiology Overview", Comp: LabOverview },
      { key: "lab-test-wise", label: "Test-Wise (Lab & Radiology)", Comp: TestWise },
      { key: "lab-turnaround", label: "Turnaround Times", Comp: Turnaround },
      { key: "lab-pending", label: "Pending & Backlog", Comp: Pending },
      { key: "lab-critical", label: "Critical Results", Comp: CriticalResults },
      { key: "lab-register", label: "Order Register (Lab & Radiology)", Comp: OrderRegister },
    ],
  },
  {
    heading: "Pharmacy & Inventory",
    module: "Pharmacy",
    adminOnly: true,
    items: [
      { key: "pharmacy-reports", label: "Pharmacy Overview", Comp: PharmacyOverview },
      { key: "opd-ipd-pharmacy", label: "OPD vs IPD Dispensing", Comp: OpdIpdSplit },
      { key: "stock-valuation", label: "Stock Valuation", Comp: StockValuation },
      { key: "expiry-loss", label: "Expiry & Loss", Comp: ExpiryLoss },
      { key: "purchase-consumption", label: "Purchase vs Consumption", Comp: PurchaseConsumption },
      { key: "reorder-list", label: "Reorder List", Comp: ReorderList },
      { key: "supplier-ledger", label: "Supplier Ledger", Comp: SupplierLedger },
      { key: "movers", label: "Fast / Slow Movers", Comp: Movers },
    ],
  },
];

export default function ReportsHub() {
  const { isModuleEnabled } = useEnabledModules();
  const { user } = useHospitalAuth();
  const isAdmin = isAdminRole(user?.role);

  /**
   * Nursing and Insurance join the catalogue here rather than living as their
   * own sidebar entries - the same arrangement lab and pharmacy already have,
   * where the panel keeps its screen and the hub carries a group built from the
   * same definitions.
   *
   * Their items are composed rather than pasted, because their own gating is
   * not uniform: a nurse's vitals and staff reports apply to any hospital,
   * while Ward & Beds needs IPD. Folding them into one flat IPD-gated group
   * would have hidden the vitals register from a hospital without in-patients.
   * Admin-only, which is exactly who could reach them before.
   */
  const groups = useMemo(() => {
    const base = GROUPS.filter((g) => (!g.module || isModuleEnabled(g.module)) && (!g.adminOnly || isAdmin));
    if (!isAdmin) return base;

    const fold = (heading: string, src: { module?: string; items: ReportItem[] }[]): ReportGroup[] => {
      const items = src.filter((g) => !g.module || isModuleEnabled(g.module)).flatMap((g) => g.items);
      return items.length ? [{ heading, items }] : [];
    };

    return [
      ...base,
      ...fold("Nursing", NURSE_REPORT_GROUPS),
      ...fold("Insurance", CLAIM_REPORT_GROUPS),
    ];
  }, [isModuleEnabled, isAdmin]);

  return (
    <ReportNavLayout
      title="Reports"
      subtitle="Every report in one place - OPD, in-patient, billing, laboratory, pharmacy, nursing and insurance"
      groups={groups}
      accent={ACCENT}
    />
  );
}

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

  // Hide a group whose module is off, and the finance groups for non-admins.
  const groups = useMemo(
    () => GROUPS.filter((g) => (!g.module || isModuleEnabled(g.module)) && (!g.adminOnly || isAdmin)),
    [isModuleEnabled, isAdmin],
  );

  return (
    <ReportNavLayout
      title="Reports"
      subtitle="All OPD, in-patient, and billing reports in one place"
      groups={groups}
      accent={ACCENT}
    />
  );
}

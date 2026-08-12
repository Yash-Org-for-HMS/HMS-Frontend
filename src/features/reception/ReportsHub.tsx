import { useMemo, useState } from "react";
import {
  Box, Paper, List, ListItemButton, ListItemText, Divider, Collapse, Chip,
} from "@mui/material";
import { ExpandLessRounded, ExpandMoreRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { isAdmin as isAdminRole } from "@/constants/roles";
import {
  DailyOpd, Analytics, Collection, ReferralsByDoctor, OpRegistration, OpBills, DiagnosisWise, Census, OpdVisitRegister,
} from "./Reports";
import { InPatients, Discharges, IpRegistrations, IpAdvances, Occupancy, OverdueDoses } from "../ipd/IpdReports";
import { Outstanding, PatientStatement, Receipts, ServiceWise, PharmacyExpense, UnreturnedAdvances } from "../billing/BillingReports";
import { DayBook, RevenueAnalytics, RefundRegister, DiscountRegister, CancelledInvoices, DoctorProductivity } from "../billing/FinanceReports";
import { LabOverview, TestWise, Turnaround, Pending, CriticalResults } from "../lab/LabReports";
import { PharmacyOverview } from "../pharmacy/PharmacyReports";
import { StockValuation, ExpiryLoss, PurchaseConsumption, ReorderList, SupplierLedger, Movers, OpdIpdSplit } from "../pharmacy/InventoryReports";
import { ACCENTS, BRAND } from "@/styles/accents";

const ACCENT = BRAND.action;

type ReportItem = { key: string; label: string; Comp: React.ComponentType };
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
      { key: "lab-turnaround", label: "Turnaround & SLA", Comp: Turnaround },
      { key: "lab-pending", label: "Pending & Backlog", Comp: Pending },
      { key: "lab-critical", label: "Critical Results", Comp: CriticalResults },
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

  // Hide the IPD group if the module is off, and the finance group for non-admins.
  const groups = useMemo(
    () => GROUPS.filter((g) => (!g.module || isModuleEnabled(g.module)) && (!g.adminOnly || isAdmin)),
    [isModuleEnabled, isAdmin],
  );

  const [active, setActive] = useState<string>(groups[0]?.items[0]?.key ?? "daily-opd");
  const ActiveComp = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((i) => i.key === active);
      if (found) return found.Comp;
    }
    return groups[0]?.items[0]?.Comp;
  }, [active, groups]);

  // Collapsible group rail: start with only the group holding the active report
  // expanded; each heading toggles independently.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const activeGroup = GROUPS.find((g) => g.items.some((i) => i.key === (GROUPS[0]?.items[0]?.key)))?.heading;
    return Object.fromEntries(GROUPS.map((g) => [g.heading, g.heading === activeGroup]));
  });
  const toggle = (heading: string) => setOpen((o) => ({ ...o, [heading]: !o[heading] }));

  return (
    <Box>
      <PageHeader title="Reports" subtitle="All OPD, in-patient, and billing reports in one place" />

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
        {/* Report picker */}
        <Paper elevation={0} sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden" }}>
          <List dense disablePadding>
            {groups.map((g, gi) => {
              const isOpen = open[g.heading] ?? false;
              const hasActive = g.items.some((i) => i.key === active);
              return (
                <Box key={g.heading}>
                  {gi > 0 && <Divider />}
                  <ListItemButton
                    onClick={() => toggle(g.heading)}
                    sx={{ py: 0.75, "&:hover": { bgcolor: "action.hover" } }}
                  >
                    <ListItemText
                      primary={g.heading}
                      primaryTypographyProps={{ fontWeight: 800, fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase", color: hasActive && !isOpen ? ACCENT : "text.secondary" }}
                    />
                    {!isOpen && hasActive && <Chip size="small" label="•" sx={{ height: 16, width: 16, mr: 0.5, bgcolor: `${ACCENT}22`, color: ACCENT, "& .MuiChip-label": { p: 0, fontWeight: 900 } }} />}
                    {isOpen ? <ExpandLessRounded fontSize="small" sx={{ color: "text.secondary" }} /> : <ExpandMoreRounded fontSize="small" sx={{ color: "text.secondary" }} />}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    {g.items.map((it) => (
                      <ListItemButton
                        key={it.key}
                        selected={active === it.key}
                        onClick={() => setActive(it.key)}
                        sx={{ py: 0.75, pl: 2.5, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` }, "&.Mui-selected:hover": { bgcolor: `${ACCENT}22` } }}
                      >
                        <ListItemText primary={it.label} primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: active === it.key ? 700 : 500, color: active === it.key ? ACCENT : "text.primary" }} />
                      </ListItemButton>
                    ))}
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Paper>

        {/* Active report */}
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          {ActiveComp ? <ActiveComp /> : null}
        </Box>
      </Box>
    </Box>
  );
}

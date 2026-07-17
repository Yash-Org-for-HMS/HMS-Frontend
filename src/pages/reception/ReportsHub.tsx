import { useMemo, useState } from "react";
import {
  Box, Paper, List, ListItemButton, ListItemText, ListSubheader, Divider,
} from "@mui/material";
import PageHeader from "../../components/layout/PageHeader";
import { useEnabledModules } from "../../hooks/useEnabledModules";
import { useHospitalAuth } from "../../providers/HospitalAuthContext";
import { isAdmin as isAdminRole } from "../../constants/roles";
import {
  DailyOpd, Analytics, Collection, ReferralsByDoctor, OpRegistration, OpBills, DiagnosisWise, Census,
} from "./Reports";
import { InPatients, Discharges, IpRegistrations, IpAdvances } from "../ipd/IpdReports";
import { Outstanding, PatientStatement, Receipts, ServiceWise, PharmacyExpense } from "../billing/BillingReports";
import LabReports from "../lab/LabReports";
import PharmacyReports from "../pharmacy/PharmacyReports";

const ACCENT = "#0891b2";

type ReportItem = { key: string; label: string; Comp: React.ComponentType };
type ReportGroup = { heading: string; module?: string; adminOnly?: boolean; items: ReportItem[] };

// Single source of truth for the whole report catalogue, grouped by area.
const GROUPS: ReportGroup[] = [
  {
    heading: "OPD",
    items: [
      { key: "daily-opd", label: "Daily OPD Summary", Comp: DailyOpd },
      { key: "appointment-analytics", label: "Appointment Analytics", Comp: Analytics },
      { key: "op-registration", label: "OP Registration", Comp: OpRegistration },
      { key: "op-bills", label: "OP Bills", Comp: OpBills },
      { key: "diagnosis-wise", label: "Diagnosis-Wise", Comp: DiagnosisWise },
      { key: "referrals", label: "Referrals by Doctor", Comp: ReferralsByDoctor },
    ],
  },
  {
    heading: "In-Patient (IPD)",
    module: "IPD",
    items: [
      { key: "ipd-census", label: "Ward Census & Occupancy", Comp: Census },
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
      { key: "collection", label: "Daily Collection", Comp: Collection },
      { key: "outstanding", label: "Outstanding Dues", Comp: Outstanding },
      { key: "receipts", label: "Receipts", Comp: Receipts },
      { key: "patient-statement", label: "Patient Account Statement", Comp: PatientStatement },
      { key: "service-wise", label: "Service-Wise Revenue", Comp: ServiceWise },
      { key: "pharmacy-expense", label: "Pharmacy Expense", Comp: PharmacyExpense },
    ],
  },
  {
    heading: "Laboratory",
    module: "Laboratory",
    adminOnly: true,
    items: [
      { key: "lab-reports", label: "Lab & Radiology", Comp: LabReports },
    ],
  },
  {
    heading: "Pharmacy",
    module: "Pharmacy",
    adminOnly: true,
    items: [
      { key: "pharmacy-reports", label: "Pharmacy", Comp: PharmacyReports },
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

  return (
    <Box>
      <PageHeader title="Reports" subtitle="All OPD, in-patient, and billing reports in one place" />

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
        {/* Report picker */}
        <Paper elevation={0} sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0, borderRadius: 3, border: "1px solid", borderColor: "divider", position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden" }}>
          <List dense disablePadding>
            {groups.map((g, gi) => (
              <Box key={g.heading}>
                {gi > 0 && <Divider />}
                <ListSubheader sx={{ fontWeight: 800, fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary", lineHeight: "36px", bgcolor: "transparent" }}>
                  {g.heading}
                </ListSubheader>
                {g.items.map((it) => (
                  <ListItemButton
                    key={it.key}
                    selected={active === it.key}
                    onClick={() => setActive(it.key)}
                    sx={{ py: 0.75, "&.Mui-selected": { bgcolor: `${ACCENT}14`, borderRight: `3px solid ${ACCENT}` }, "&.Mui-selected:hover": { bgcolor: `${ACCENT}22` } }}
                  >
                    <ListItemText primary={it.label} primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: active === it.key ? 700 : 500, color: active === it.key ? ACCENT : "text.primary" }} />
                  </ListItemButton>
                ))}
              </Box>
            ))}
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

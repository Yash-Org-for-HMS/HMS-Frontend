import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Paper, Tab, Tabs } from "@mui/material";
import { LocalHospitalRounded, SettingsRounded, ApartmentRounded, WidgetsRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import { BRAND } from "@/styles/accents";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";

const HospitalProfile = lazy(() => import("./HospitalProfile"));
const HospitalSettings = lazy(() => import("./HospitalSettings"));
const BranchesPage = lazy(() => import("./branches/BranchesPage"));
const ModuleAccess = lazy(() => import("./settings/ModuleAccess"));

const ACCENT = BRAND.action;

interface HospitalTab { path: string; label: string; icon: ReactElement; subtitle: string; Page: ComponentType<{ embedded?: boolean }> }

/**
 * Who the hospital is and how it runs, on one page: the profile, settings,
 * branches and modules used to be four sidebar entries. Each tab keeps its own
 * address (/hospital/profile, /hospital/settings, ...), so links, bookmarks
 * and the "finish your profile" redirect still land on the right tab.
 */
const TABS: HospitalTab[] = [
  { path: "/hospital/profile", label: "Organisation profile", icon: <LocalHospitalRounded fontSize="small" />, Page: HospitalProfile,
    subtitle: "The organisation as a whole - its name, branding, registered address and compliance details." },
  { path: "/hospital/settings", label: "Settings", icon: <SettingsRounded fontSize="small" />, Page: HospitalSettings,
    subtitle: "Appointments, localization, notifications and billing defaults." },
  { path: "/hospital/branches", label: "Branches", icon: <ApartmentRounded fontSize="small" />, Page: BranchesPage,
    subtitle: "Where each branch is and how it is registered." },
  { path: "/hospital/module-access", label: "Modules", icon: <WidgetsRounded fontSize="small" />, Page: ModuleAccess,
    subtitle: "Turn modules your plan includes on or off. Modules outside your plan are locked - contact your provider to upgrade." },
];

export default function HospitalSetup() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useHospitalAuth();
  const current = TABS.find((t) => t.path === pathname) ?? TABS[0];
  // The sidebar shows this page to the hospital admin only; anyone else who
  // lands on one of these addresses sees just that page, not the others.
  const tabs = hasRole(user, "H_ADMIN") ? TABS : [current];
  const { Page } = current;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", width: "100%" }}>
      <PageHeader title="Hospital" subtitle={current.subtitle} />
      {tabs.length > 1 && (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
          <Tabs value={current.path} onChange={(_, path: string) => navigate(path)} variant="scrollable" scrollButtons="auto"
            sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
            {tabs.map((t) => <Tab key={t.path} value={t.path} icon={t.icon} iconPosition="start" label={t.label} />)}
          </Tabs>
        </Paper>
      )}
      <Suspense fallback={<PageSkeleton />}>
        <Page embedded />
      </Suspense>
    </Box>
  );
}

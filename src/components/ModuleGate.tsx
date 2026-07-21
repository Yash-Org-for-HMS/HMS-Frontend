import type { ReactNode } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { LockRounded, WorkspacePremiumRounded } from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";

// Friendly labels for the licensable modules (mirrors config/modules on the API).
const MODULE_LABELS: Record<string, string> = {
  OPD: "OPD / Reception",
  Doctor: "Doctor Consultations",
  IPD: "In-Patient (IPD)",
  Laboratory: "Laboratory & Radiology",
  Pharmacy: "Pharmacy",
  Billing: "Billing",
};

/**
 * The "locked feature" upsell shown when a hospital's plan doesn't include a
 * module. Rather than hiding the feature, we show that it EXISTS and can be
 * unlocked by upgrading — so tenants discover what's available. Reusable: drop it
 * (or wrap a page in <ModuleGate>) anywhere a plan-gated feature lives.
 */
export function ModuleLocked({ module, feature, description }: { module: string; feature?: string; description?: string }) {
  const moduleLabel = MODULE_LABELS[module] || module;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "60vh", px: 3, gap: 1.75 }}>
      <Box sx={{ position: "relative", width: 76, height: 76, borderRadius: "50%", bgcolor: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LockRounded sx={{ fontSize: 38, color: "#f59e0b" }} />
      </Box>
      <Chip
        icon={<WorkspacePremiumRounded sx={{ fontSize: "16px !important" }} />}
        label="Available on upgrade"
        size="small"
        sx={{ fontWeight: 700, bgcolor: "rgba(245, 158, 11, 0.12)", color: "#b45309" }}
      />
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        {feature || moduleLabel} is a premium feature
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 460, lineHeight: 1.7 }}>
        {description ? `${description} ` : ""}
        {feature
          ? `It's part of the ${moduleLabel} module, which isn't included in your current plan. `
          : `The ${moduleLabel} module isn't included in your current plan. `}
        Upgrade your plan to unlock it — contact your provider to enable it for your hospital.
      </Typography>
    </Box>
  );
}

/**
 * Wraps a plan-gated page/panel. When the hospital's plan doesn't include the
 * module, it renders the upsell instead of the children. Fail-open: until module
 * state is known, children render normally (the API still enforces).
 */
export default function ModuleGate({
  module, feature, description, children,
}: { module: string; feature?: string; description?: string; children: ReactNode }) {
  const { loaded, isModuleEnabled } = useEnabledModules();

  if (loaded && !isModuleEnabled(module)) {
    return <ModuleLocked module={module} feature={feature} description={description} />;
  }
  return <>{children}</>;
}

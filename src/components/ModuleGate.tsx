import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { BlockRounded } from "@mui/icons-material";
import { useEnabledModules } from "@/hooks/useEnabledModules";

/**
 * Wraps a panel's content and shows a friendly "not enabled" message when the
 * hospital doesn't have the module — so a disabled panel isn't a wall of failing
 * (403) requests. Fail-open: until module state is known, content renders
 * normally (the API still enforces).
 */
export default function ModuleGate({ module, children }: { module: string; children: ReactNode }) {
  const { loaded, isModuleEnabled } = useEnabledModules();

  if (loaded && !isModuleEnabled(module)) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "60vh", px: 3, gap: 1.5 }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BlockRounded sx={{ fontSize: 34, color: "text.secondary" }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>This module isn’t enabled</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 420 }}>
          The {module} module isn’t enabled for your hospital. Contact your administrator or provider to enable it.
        </Typography>
      </Box>
    );
  }
  return <>{children}</>;
}

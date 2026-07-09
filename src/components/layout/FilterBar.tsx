import { Box } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Consistent container for search inputs, filter dropdowns and toggles placed
 * directly above a list/table. Keeps filter controls in the same spot on every
 * page.
 */
export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        mb: 3,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {children}
    </Box>
  );
}

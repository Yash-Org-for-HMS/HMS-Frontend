import { useMemo, useState } from "react";
import { apiErrorText } from "@/utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, useTheme, Fade, alpha,
} from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

// Radiology tests are mastered in the Schedule of Charges (a charge with
// Type = "Radiology test"), organized into imaging categories (X-Ray, CT, MRI…).
// This screen is a read-only view of that catalogue, grouped by category.
export default function RadiologyCatalog() {
  const theme = useTheme();
  const [activeCat, setActiveCat] = useState<string>(""); // "" = all categories

  const { data: scans = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["radiology-catalog"],
    queryFn: async () => (await axiosInstance.get("/lab/radiology-catalog")).data.data || [],
  });

  // Group tests by their SOC category, sorted; tests sorted by name within a group.
  const groups = useMemo(() => {
    const by = new Map<string, any[]>();
    for (const s of scans) {
      const c = s.category || "Radiology";
      if (!by.has(c)) by.set(c, []);
      by.get(c)!.push(s);
    }
    return [...by.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, items]) => ({ cat, items: items.slice().sort((a, b) => String(a.testName).localeCompare(String(b.testName))) }));
  }, [scans]);

  const visible = activeCat ? groups.filter((g) => g.cat === activeCat) : groups;

  return (
    <Box>
      <PageHeader
        title="Radiology Catalog"
        subtitle="The radiology tests available for ordering, grouped by category."
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.5, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08), border: "1px solid", borderColor: alpha(theme.palette.info.main, 0.25) }}>
        <InfoOutlined fontSize="small" color="info" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Radiology tests are managed in <b>Schedule of Charges</b> — add a charge with <b>Type: Radiology test</b> under a category and it appears here and in the order screens, priced from the rate card.
        </Typography>
      </Box>

      {groups.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          <Chip label={`All (${scans.length})`} onClick={() => setActiveCat("")} color={activeCat === "" ? "primary" : "default"}
            variant={activeCat === "" ? "filled" : "outlined"} size="small" />
          {groups.map((g) => (
            <Chip key={g.cat} label={`${g.cat} (${g.items.length})`} onClick={() => setActiveCat(g.cat)}
              color={activeCat === g.cat ? "primary" : "default"} variant={activeCat === g.cat ? "filled" : "outlined"} size="small" />
          ))}
        </Box>
      )}

      <Paper sx={{ borderRadius: 4, overflow: "hidden", border: "1px solid", borderColor: "divider", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : scans.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="No radiology tests yet" subtitle="Add them in Schedule of Charges (Type: Radiology test)." />
        ) : (
          <Fade in timeout={500}>
            <TableContainer sx={{ maxHeight: "calc(100vh - 360px)" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Scan Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Code</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.flatMap((g) => [
                    <TableRow key={`h-${g.cat}`}>
                      <TableCell colSpan={3} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06), py: 0.75 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "primary.main" }}>
                          {g.cat} · {g.items.length}
                        </Typography>
                      </TableCell>
                    </TableRow>,
                    ...g.items.map((scan) => (
                      <TableRow key={scan.chargeItemId || scan.testName} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{scan.testName}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{scan.testCode || "—"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(Number(scan.price))}</TableCell>
                      </TableRow>
                    )),
                  ])}
                </TableBody>
              </Table>
            </TableContainer>
          </Fade>
        )}
      </Paper>
    </Box>
  );
}

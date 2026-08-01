import { apiErrorText } from "@/utils/apiError";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useTheme, Fade, alpha,
} from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";

// Radiology tests are now mastered in the Schedule of Charges (a charge with
// Type = "Radiology test"). This screen is a read-only view of that catalogue;
// add / edit / price a test in Schedule of Charges.
export default function RadiologyCatalog() {
  const theme = useTheme();

  const { data: scans = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["radiology-catalog"],
    queryFn: async () => (await axiosInstance.get("/lab/radiology-catalog")).data.data || [],
  });

  const { sorted, orderBy, order, onSort } = useTableSort(scans, {
    testCode: (s) => s.testCode,
    testName: (s) => s.testName,
    price: (s) => Number(s.price),
  });

  return (
    <Box>
      <PageHeader
        title="Radiology Catalog"
        subtitle="The radiology tests available for ordering, with their prices."
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.5, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08), border: "1px solid", borderColor: alpha(theme.palette.info.main, 0.25) }}>
        <InfoOutlined fontSize="small" color="info" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Radiology tests are managed in <b>Schedule of Charges</b> — add a charge with <b>Type: Radiology test</b> and it appears here and in the order screens, priced from the rate card.
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 4, overflow: "hidden", border: "1px solid", borderColor: "divider", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : scans.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="No radiology tests yet" subtitle="Add them in Schedule of Charges (Type: Radiology test)." />
        ) : (
          <Fade in timeout={500}>
            <TableContainer sx={{ maxHeight: "calc(100vh - 320px)" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <SortableHeadCell label="Scan Code" sortKey="testCode" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                    <SortableHeadCell label="Scan Name" sortKey="testName" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                    <SortableHeadCell label="Price" sortKey="price" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 700, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 2, color: "text.primary" }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((scan) => (
                    <TableRow key={scan.chargeItemId || scan.testName} hover>
                      <TableCell sx={{ fontWeight: 600, fontFamily: "monospace", color: "#0284C7" }}>{scan.testCode || "—"}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{scan.testName}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatINR(Number(scan.price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Fade>
        )}
      </Paper>
    </Box>
  );
}

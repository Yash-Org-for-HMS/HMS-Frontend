import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, TextField, InputAdornment, Typography, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasAction } from "@/constants/roles";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useClientPage } from "@/components/table/useClientPage";

/**
 * Ward postings - Nursing Administration's (15_System_Roles: "all wards:
 * roster, postings, nurse reports"). Which ward each nurse works on, changed
 * in place. The server keeps the previous posting as history, the same as the
 * Staff Directory, and refuses anyone who is not nursing staff.
 */

interface NurseRow {
  staffId: string;
  name: string;
  designationName: string | null;
  grade: number | null;
  branchName: string | null;
  posting: { postingType: string; wardId: string | null; label: string } | null;
}
interface WardOption { wardId: string; wardName: string; wardCode: string | null }

export default function NursePostings() {
  const { user } = useHospitalAuth();
  const allowed = hasAction(user, "nurse.postings");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<Set<string>>(() => new Set());

  const { data, isLoading, isError, error, refetch } = useQuery<{ nurses: NurseRow[]; wards: WardOption[] }>({
    queryKey: ["nursing-postings"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/nursing-postings")).data.data,
    enabled: allowed,
  });

  const nurses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.nurses ?? [];
    return term ? list.filter((n) => `${n.name} ${n.designationName ?? ""} ${n.posting?.label ?? ""}`.toLowerCase().includes(term)) : list;
  }, [data, search]);
  const { shown, pager } = useClientPage(nurses, { size: 25, resetKey: search });

  const setRow = (staffId: string, posting: NurseRow["posting"]) =>
    queryClient.setQueryData<{ nurses: NurseRow[]; wards: WardOption[] }>(["nursing-postings"], (old) =>
      old && { ...old, nurses: old.nurses.map((x) => (x.staffId === staffId ? { ...x, posting } : x)) });
  const busy = (staffId: string, on: boolean) =>
    setSaving((prev) => { const next = new Set(prev); if (on) next.add(staffId); else next.delete(staffId); return next; });

  // The dropdown shows the new ward at once and the save runs behind it; the
  // row is then patched from the server's answer instead of reloading every nurse.
  const post = async (nurse: NurseRow, wardId: string) => {
    const ward = data?.wards.find((w) => w.wardId === wardId);
    const before = nurse.posting;
    setRow(nurse.staffId, ward ? { postingType: before?.postingType ?? "WARD", wardId, label: ward.wardName } : null);
    busy(nurse.staffId, true);
    try {
      const res = await axiosInstance.put(`/hospital/staff/${nurse.staffId}/posting`, { wardId: wardId || null });
      setRow(nurse.staffId, res.data?.data?.posting ?? null);
      toast.success(ward ? `${nurse.name} posted to ${ward.wardName}` : `${nurse.name} taken off their ward`);
    } catch (err) {
      setRow(nurse.staffId, before);
      toast.error(getApiErrorMessage(err, "Couldn't change the posting"));
    } finally {
      busy(nurse.staffId, false);
    }
  };

  if (!allowed) {
    return (
      <Box>
        <PageHeader title="Ward postings" subtitle="Which ward each nurse works on." />
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Ward postings are set by Nursing Administration. Ask them, or the hospital admin, to change a posting.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Ward postings" subtitle="Which ward each nurse works on. A change keeps the previous posting as history." />

      <Box sx={{ display: "flex", mb: 2 }}>
        <TextField
          size="small" placeholder="Search nurses or wards" value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
        />
      </Box>

      {isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nurse</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell sx={{ width: 300 }}>Ward</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={5} columns={4} />
              ) : nurses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Mascot
                      pose={search ? "no-matches" : "nothing-here-yet"}
                      title={search ? "No nurse matches that search" : "No nursing staff at this branch yet"}
                    />
                  </TableCell>
                </TableRow>
              ) : shown.map((n) => (
                <TableRow key={n.staffId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{n.name}</TableCell>
                  <TableCell>{n.designationName ?? "-"}</TableCell>
                  <TableCell>{n.branchName ?? "-"}</TableCell>
                  <TableCell>
                    <TextField
                      select size="small" fullWidth value={n.posting?.wardId ?? ""}
                      onChange={(e) => post(n, e.target.value)}
                      disabled={saving.has(n.staffId)}
                      slotProps={{ select: { displayEmpty: true, inputProps: { "aria-label": `Ward for ${n.name}` } } }}
                    >
                      <MenuItem value=""><em>Not posted to a ward</em></MenuItem>
                      {(data?.wards ?? []).map((w) => (
                        <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}{w.wardCode ? ` (${w.wardCode})` : ""}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!isError && pager}
    </Box>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paper, Stack, Typography, Chip, Button, Box } from "@mui/material";
import { PlaceRounded, SwapHorizRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { SEMANTIC } from "@/styles/accents";

/**
 * "Today: Branch A 10:00–14:00 · Branch B 14:00–19:00" on the doctor's
 * dashboard, and — when the clock says they should be at another branch than
 * the one they are working in — a button to switch to it. Shown only when the
 * doctor's hours name branches; a doctor working one place sees nothing new.
 */

interface TodayHours {
  windows: { branchId: string | null; branchName: string | null; startTime: string; endTime: string }[];
  leave: { branchId: string | null; branchName: string | null; startTime: string | null; endTime: string | null; reason: string | null }[];
}

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };

export default function TodayAtBranches() {
  const { activeBranchId, availableBranches, setActiveBranch } = useHospitalAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery<TodayHours>({
    queryKey: ["doctor-today-hours"],
    queryFn: async () => (await axiosInstance.get("/doctor/today-hours")).data.data,
  });
  // Re-read the clock each minute so "now" follows the day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const windows = data?.windows ?? [];
  if (!windows.some((w) => w.branchId)) return null;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = windows.find((w) => minutes(w.startTime) <= nowMin && nowMin < minutes(w.endTime));
  const shouldBeAt = current?.branchId && current.branchId !== activeBranchId && availableBranches.some((b) => b.branchId === current.branchId)
    ? current : null;

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <PlaceRounded color="action" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mr: 0.5 }}>Today</Typography>
          {windows.map((w, i) => {
            const isNow = w === current;
            return (
              <Chip key={i} size="small"
                label={`${w.branchName ?? "Every branch"} ${fmt12(w.startTime)} – ${fmt12(w.endTime)}`}
                sx={{ fontWeight: isNow ? 700 : 500, bgcolor: isNow ? `${SEMANTIC.success}1f` : "action.hover", color: isNow ? SEMANTIC.success : "text.primary" }} />
            );
          })}
          {(data?.leave ?? []).map((l, i) => (
            <Chip key={`l${i}`} size="small" color="error" variant="outlined"
              label={`Leave${l.branchName ? ` at ${l.branchName}` : ""}${l.startTime && l.endTime ? ` ${fmt12(l.startTime)} – ${fmt12(l.endTime)}` : " all day"}`} />
          ))}
        </Stack>
        {shouldBeAt && (
          <Box>
            <Button size="small" variant="contained" startIcon={<SwapHorizRounded />}
              onClick={() => { setActiveBranch(shouldBeAt.branchId); queryClient.removeQueries(); }}>
              Switch to {shouldBeAt.branchName}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

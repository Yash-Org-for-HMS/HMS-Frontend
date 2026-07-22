import { useState } from "react";
import { ACCENTS, NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Chip, Button, Stack, Divider, Tooltip,
} from "@mui/material";
import { CheckRounded, CloseRounded, PauseRounded, UndoRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";
import Mascot from "../Mascot";

const DOSE_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Due", color: "#b45309", bg: "rgba(245,158,11,0.15)" },
  GIVEN: { label: "Given", color: "#047857", bg: "rgba(16,185,129,0.15)" },
  MISSED: { label: "Missed", color: "#b91c1c", bg: "rgba(239,68,68,0.15)" },
  HELD: { label: "Held", color: NEUTRAL.textSecondary, bg: "rgba(100,116,139,0.15)" },
};

export default function MarChart({ admissionId }: { admissionId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const key = ["ipd-admission-mar", admissionId];
  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: key,
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}/mar`)).data.data,
    enabled: !!admissionId,
  });

  const setStatus = async (adminId: string, status: string) => {
    setBusy(adminId);
    try {
      await axiosInstance.post(`/ipd/mar/${adminId}`, { status });
      await refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update dose"));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Box sx={{ py: 4, textAlign: "center" }}><HeartbeatLoader size={28} /></Box>;

  const scheduled = orders.filter((o) => (o.doses || []).length > 0);
  if (scheduled.length === 0) {
    return <Box sx={{ py: 3 }}><Mascot pose="all-caught-up" title="No scheduled doses" subtitle="Assign a medicine with a frequency (OD/BD/TDS…) and duration to build a chart." size={110} /></Box>;
  }

  return (
    <Stack spacing={2.5}>
      {scheduled.map((o) => (
        <Box key={o.ipMedOrderId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 1.5, py: 1, bgcolor: "action.hover", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{o.medicineName}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{[o.dosage, o.frequency, o.route].filter(Boolean).join(" · ")}</Typography>
            </Box>
            {o.status === "BILLED" && <Chip label="Billed" size="small" sx={{ bgcolor: "rgba(8,145,178,0.12)", color: ACCENTS.ipd, fontWeight: 700 }} />}
          </Box>
          <Box sx={{ p: 1 }}>
            {o.doses.map((d: any, i: number) => {
              const m = DOSE_META[d.status] || DOSE_META.PENDING;
              const isPending = d.status === "PENDING";
              return (
                <Box key={d.ipMedAdminId}>
                  {i > 0 && <Divider component="div" />}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.75, gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ minWidth: 140 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(d.scheduledAt).format("DD MMM, HH:mm")}</Typography>
                      {d.administeredAt && <Typography variant="caption" sx={{ color: "text.secondary" }}>at {dayjs(d.administeredAt).format("HH:mm")}</Typography>}
                    </Box>
                    <Chip size="small" label={m.label} sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700 }} />
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {isPending ? (
                        <>
                          <Tooltip title="Given"><Button size="small" variant="outlined" disabled={busy === d.ipMedAdminId} onClick={() => setStatus(d.ipMedAdminId, "GIVEN")} startIcon={<CheckRounded />} sx={{ minWidth: 0, borderColor: "rgba(16,185,129,0.5)", color: "#047857" }}>Give</Button></Tooltip>
                          <Tooltip title="Missed"><Button size="small" variant="outlined" disabled={busy === d.ipMedAdminId} onClick={() => setStatus(d.ipMedAdminId, "MISSED")} sx={{ minWidth: 0, borderColor: "rgba(239,68,68,0.4)", color: "#b91c1c" }}><CloseRounded fontSize="small" /></Button></Tooltip>
                          <Tooltip title="Held"><Button size="small" variant="outlined" disabled={busy === d.ipMedAdminId} onClick={() => setStatus(d.ipMedAdminId, "HELD")} sx={{ minWidth: 0, borderColor: "divider", color: "text.secondary" }}><PauseRounded fontSize="small" /></Button></Tooltip>
                        </>
                      ) : (
                        <Tooltip title="Undo"><Button size="small" disabled={busy === d.ipMedAdminId} onClick={() => setStatus(d.ipMedAdminId, "PENDING")} startIcon={<UndoRounded />} sx={{ minWidth: 0, color: "text.secondary" }}>Undo</Button></Tooltip>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Button } from "@mui/material";
import { DrawRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { axiosInstance } from "@/api/axios";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";

/**
 * Certificates the record room prepared in this doctor's name. A certificate is
 * issued (and can be printed) only once the doctor named on it signs it here.
 */
interface ToSign {
  certificateId: string; certNumber: string; certType: "MEDICAL" | "FITNESS" | "DEATH"; preparedAt: string;
  patientName: string; uhid: string; details: Record<string, string | null>;
}

const TYPE_LABEL = { MEDICAL: "Medical", FITNESS: "Fitness", DEATH: "Death" } as const;
const day = (v: string | null | undefined) => (v ? dayjs(v).format("DD MMM YYYY") : "-");

/** One line saying what the certificate states, so the doctor signs knowing it. */
function says(c: ToSign): string {
  const d = c.details;
  if (c.certType === "MEDICAL") return `${d.diagnosis ?? ""} - rest ${day(d.restFrom)} to ${day(d.restTo)}`;
  if (c.certType === "FITNESS") return `Fit from ${day(d.fitFrom)} - ${d.purpose ?? ""}`;
  return `Died ${d.dateOfDeath ? dayjs(d.dateOfDeath).format("DD MMM YYYY, h:mm A") : "-"} - ${d.causeImmediate ?? ""} (${(d.mannerOfDeath ?? "").toLowerCase()})`;
}

export default function CertificatesToSign() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery<ToSign[]>({
    queryKey: ["certificates-to-sign"],
    queryFn: async () => (await axiosInstance.get("/certificates/to-sign")).data.data ?? [],
  });

  const sign = async (c: ToSign) => {
    const ok = await confirm({
      title: `Sign ${c.certNumber}`,
      message: `${TYPE_LABEL[c.certType]} certificate for ${c.patientName}: ${says(c)}. Signing issues it in your name.`,
      confirmText: "Sign and issue",
    });
    if (!ok) return;
    setBusy(c.certificateId);
    try {
      await axiosInstance.post(`/certificates/${c.certificateId}/sign`);
      toast.success(`${c.certNumber} signed and issued`);
      await q.refetch();
      queryClient.invalidateQueries({ queryKey: ["doctor-badges"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't sign the certificate"));
    } finally {
      setBusy(null);
    }
  };

  const rows = q.data ?? [];
  return (
    <Box>
      <PageHeader title="Certificates to sign" subtitle="Prepared by medical records in your name. Each is issued, and can be printed, only once you sign it." />
      {q.isError ? (
        <ErrorState title="Couldn't load the list" message={apiErrorText(q.error)} onRetry={() => q.refetch()} />
      ) : !q.isLoading && rows.length === 0 ? (
        <Paper sx={{ p: 3 }}><Mascot pose="all-caught-up" title="Nothing waiting for your signature" /></Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Certificate</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>What it states</TableCell>
                <TableCell>Prepared</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={3} columns={5} /> : rows.map((c) => (
                <TableRow key={c.certificateId} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.certNumber}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{TYPE_LABEL[c.certType]}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{c.uhid}</Typography>
                  </TableCell>
                  <TableCell>{says(c)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(c.preparedAt).format("DD MMM YYYY, h:mm A")}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" startIcon={<DrawRounded />} disabled={busy === c.certificateId} onClick={() => void sign(c)}>Sign</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

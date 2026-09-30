import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Typography, Chip, Button, Stack, Alert } from "@mui/material";
import { EditRounded, PlaceRounded, ReceiptLongRounded, TuneRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { apiErrorText } from "@/utils/apiError";
import { SEMANTIC } from "@/styles/accents";
import BranchDialog from "./BranchDialog";
import { letterheadAddress } from "@/hooks/useLetterhead";
import type { BranchesResponse, BranchRow } from "./branches.types";
import { VITALS_LABEL, LAB_BILLING_LABEL } from "./branches.types";

/**
 * Hospital settings → Branches. The details of the branches the hospital has:
 * address, contacts and GST registration for their printouts, and the settings
 * a branch runs differently. Adding, renaming, closing and plans are the super
 * admin's, so this page edits existing branches only.
 */

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** What this branch does differently, in words; empty when it follows the hospital in everything. */
function ownSettings(b: BranchRow): string[] {
  const s = b.settings;
  if (!s) return [];
  const out: string[] = [];
  if (s.vitalsCollector) out.push(VITALS_LABEL[s.vitalsCollector]);
  if (s.billingStrategy) out.push(LAB_BILLING_LABEL[s.billingStrategy]);
  if (s.refundApprovalThreshold != null) {
    const n = Number(s.refundApprovalThreshold);
    out.push(n === 0 ? "Every refund needs approval" : `Refunds from ₹${n.toLocaleString("en-IN")} need approval`);
  }
  if (s.opdStartTime && s.opdEndTime) out.push(`OPD ${fmt12(s.opdStartTime)} – ${fmt12(s.opdEndTime)}, ${s.opdSlotMinutes}-min`);
  return out;
}

export default function BranchesPage() {
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery<BranchesResponse>({
    queryKey: ["hospital-branches"],
    queryFn: async () => (await axiosInstance.get("/hospital/branches")).data.data,
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !data) return <ErrorState title="Couldn't load branches" message={apiErrorText(error)} onRetry={() => refetch()} />;

  const { hospital, branches } = data;
  const line = (label: string, value: string | null, inherited: string | null) => (
    <Typography variant="body2" sx={{ color: value ? "text.primary" : "text.secondary" }}>
      <Box component="span" sx={{ color: "text.secondary", mr: 0.75 }}>{label}</Box>
      {value || (inherited ? `Hospital's — ${inherited}` : "Not set")}
    </Typography>
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", width: "100%" }}>
      <PageHeader
        title="Branches"
        subtitle="Where each branch is, how it is registered, and what it does differently from the rest of the hospital."
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        To add, rename or close a branch, or change its plan, contact your Dolphin administrator. Anything left empty here follows the hospital's own details and settings.
      </Alert>

      <Stack spacing={2}>
        {branches.map((b) => {
          const open = b.status === "active";
          const address = letterheadAddress(b);
          const hospitalAddress = letterheadAddress(hospital);
          const own = ownSettings(b);
          return (
            <Paper key={b.branchId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", opacity: open ? 1 : 0.7 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{b.branchName}</Typography>
                    <Chip size="small" label={b.branchCode} variant="outlined" />
                    <Chip size="small" label={open ? "Open" : "Closed"}
                      sx={{ fontWeight: 700, bgcolor: open ? `${SEMANTIC.success}1f` : "action.hover", color: open ? SEMANTIC.success : "text.secondary" }} />
                  </Stack>
                </Box>
                <Button variant="outlined" startIcon={<EditRounded />} disabled={!open} onClick={() => setEditing(b)}>
                  Edit details
                </Button>
              </Stack>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.75} alignItems="center"><PlaceRounded fontSize="small" color="action" /><Typography variant="overline" sx={{ lineHeight: 1.5 }}>Address</Typography></Stack>
                  <Typography variant="body2" sx={{ color: b.addressLine1 ? "text.primary" : "text.secondary" }}>
                    {b.addressLine1 ? address : hospitalAddress ? `Hospital's — ${hospitalAddress}` : "Not set"}
                  </Typography>
                  {line("Phone", b.phone, hospital.officialPhone)}
                  {line("Email", b.email, hospital.officialEmail)}
                </Stack>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.75} alignItems="center"><ReceiptLongRounded fontSize="small" color="action" /><Typography variant="overline" sx={{ lineHeight: 1.5 }}>Registration</Typography></Stack>
                  {line("GSTIN", b.gstNumber, hospital.gstNumber)}
                  {line("Reg. no.", b.registrationNumber, hospital.registrationNumber)}
                  {b.licensedBeds != null && line("Licensed beds", String(b.licensedBeds), null)}
                </Stack>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.75} alignItems="center"><TuneRounded fontSize="small" color="action" /><Typography variant="overline" sx={{ lineHeight: 1.5 }}>Runs differently</Typography></Stack>
                  {own.length
                    ? own.map((t) => <Typography key={t} variant="body2">{t}</Typography>)
                    : <Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing — follows the hospital's settings</Typography>}
                </Stack>
              </Box>
            </Paper>
          );
        })}
      </Stack>

      {editing && (
        <BranchDialog
          branch={editing}
          hospital={hospital}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch(); }}
        />
      )}
    </Box>
  );
}

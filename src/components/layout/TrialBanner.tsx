import { Box, Typography, Tooltip } from "@mui/material";
import { AccessTimeRounded, WarningAmberRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

interface TrialStatus {
  isTrial: boolean;
  status: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  autoExpire: boolean;
  planName: string | null;
}

/**
 * Slim countdown banner shown to users inside a TRIAL tenant. Self-contained:
 * fetches its own status and renders nothing when the hospital isn't on a trial
 * (or the trial already converted). Colour escalates as the end date nears so a
 * trial never silently expires out from under the admin.
 */
export default function TrialBanner() {
  const { data } = useQuery<TrialStatus>({
    queryKey: ["hospital-trial-status"],
    queryFn: async () => (await axiosInstance.get("/hospital/profile/trial-status")).data.data,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (!data?.isTrial) return null;

  const days = data.daysRemaining ?? 0;
  const ending = days <= 5; // amber → orange/red as it nears zero

  // Tier the colour by urgency.
  const tone = days <= 1
    ? { bg: "#FEF2F2", border: "#FECACA", fg: "#B91C1C" }   // ≤1 day / overdue: red
    : ending
    ? { bg: "#FFF7ED", border: "#FED7AA", fg: "#C2410C" }   // ≤5 days: orange
    : { bg: "#FEFCE8", border: "#FEF08A", fg: "#A16207" };  // otherwise: amber

  const label =
    days < 0
      ? "Your trial has ended"
      : days === 0
      ? "Your trial ends today"
      : `Trial — ${days} day${days === 1 ? "" : "s"} remaining`;

  const endText = data.endDate
    ? new Date(data.endDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2,
        py: 1,
        mb: 2.5,
        borderRadius: 2,
        bgcolor: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
      }}
    >
      {ending ? <WarningAmberRounded sx={{ fontSize: 20 }} /> : <AccessTimeRounded sx={{ fontSize: 20 }} />}
      <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{label}</Typography>
      {data.planName && (
        <Typography sx={{ fontSize: "0.8rem", opacity: 0.85 }}>· {data.planName} plan</Typography>
      )}
      {endText && (
        <Tooltip title="Trial end date">
          <Typography sx={{ fontSize: "0.8rem", opacity: 0.7 }}>· ends {endText}</Typography>
        </Tooltip>
      )}
      <Typography sx={{ fontSize: "0.8rem", opacity: 0.85, ml: "auto", display: { xs: "none", sm: "block" } }}>
        Contact your provider to upgrade and keep your data.
      </Typography>
    </Box>
  );
}

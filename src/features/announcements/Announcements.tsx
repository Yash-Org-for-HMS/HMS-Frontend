import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Paper, Typography, Stack, Button } from "@mui/material";
import {
  CampaignRounded, WarningAmberRounded, ErrorOutlineRounded, InfoOutlined,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import SoftChip from "@/components/SoftChip";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import PageSkeleton from "@/components/PageSkeleton";
import { axiosInstance } from "@/api/axios";
import { apiErrorText } from "@/utils/apiError";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { ANNOUNCEMENTS_KEY, ANNOUNCEMENT_BADGE_KEY } from "./useAnnouncementBadge";

interface Announcement {
  announcementId: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  publishAt: string;
  expiresAt: string | null;
  readAt: string | null;
}

const TONE = {
  INFO: { color: SEMANTIC.info, bg: "rgba(59,130,246,0.12)", icon: <InfoOutlined sx={{ fontSize: 14 }} />, label: "Notice" },
  WARNING: { color: SEMANTIC.warning, bg: "rgba(245,158,11,0.14)", icon: <WarningAmberRounded sx={{ fontSize: 14 }} />, label: "Important" },
  CRITICAL: { color: SEMANTIC.danger, bg: "rgba(239,68,68,0.14)", icon: <ErrorOutlineRounded sx={{ fontSize: 14 }} />, label: "Urgent" },
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Announcements from the platform operator, for whichever panel the signed-in
 * user belongs to. One component serves all six panels - the API decides what
 * this particular user may see, so the page never needs to know which panel it
 * is rendering in.
 */
export default function Announcements() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: async () => (await axiosInstance.get("/hospital/announcements")).data.data as Announcement[],
  });

  const markRead = useMutation({
    mutationFn: (id: string) => axiosInstance.post(`/hospital/announcements/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_BADGE_KEY });
    },
  });

  const unread = useMemo(() => (data ?? []).filter((a) => !a.readAt), [data]);

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState message={apiErrorText(error)} onRetry={refetch} />;

  const items = data ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        subtitle={
          items.length === 0
            ? "Messages from the platform team"
            : `${unread.length} unread of ${items.length}`
        }
        actions={
          unread.length > 1 ? (
            <Button
              size="small"
              variant="outlined"
              disabled={markRead.isPending}
              onClick={() => unread.forEach((a) => markRead.mutate(a.announcementId))}
            >
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <Mascot pose="nothing-here-yet" title="Nothing to read" subtitle="Announcements from the platform team will appear here." />
      ) : (
        <Stack spacing={1.5}>
          {items.map((a) => {
            const tone = TONE[a.severity] ?? TONE.INFO;
            const isUnread = !a.readAt;
            return (
              <Paper
                key={a.announcementId}
                variant="outlined"
                onClick={() => isUnread && markRead.mutate(a.announcementId)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  cursor: isUnread ? "pointer" : "default",
                  // The unread cue is the left rail, not a background wash: a
                  // tinted card would fight the severity colour beside it.
                  borderLeft: `3px solid ${isUnread ? tone.color : "transparent"}`,
                  bgcolor: isUnread ? "background.paper" : "transparent",
                  transition: "border-color 0.2s ease",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.75 }}>
                  <SoftChip label={tone.label} icon={tone.icon} bg={tone.bg} color={tone.color} />
                  {isUnread && <SoftChip label="New" bg="rgba(15,23,42,0.08)" color={NEUTRAL.textPrimary} />}
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" sx={{ color: NEUTRAL.muted }}>
                    {when(a.publishAt)}
                  </Typography>
                </Stack>

                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{a.title}</Typography>
                <Typography variant="body2" sx={{ color: NEUTRAL.muted, whiteSpace: "pre-wrap" }}>
                  {a.body}
                </Typography>
              </Paper>
            );
          })}
        </Stack>
      )}
    </PageContainer>
  );
}

export { CampaignRounded as AnnouncementsIcon };

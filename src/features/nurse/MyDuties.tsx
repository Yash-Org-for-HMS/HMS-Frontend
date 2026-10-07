import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Box, Paper, Typography, Chip, Skeleton } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import { BRAND } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";

/**
 * A nurse's own shifts for the next two weeks (backend /roster/mine): which
 * day, which shift, which ward. Planning stays with the in-charge and nursing
 * administration (Duty roster); every nurse can see where they are expected.
 */

interface Duty { dutyDate: string; shiftName: string; shiftStart: string; shiftEnd: string; wardName: string }

const DAYS = 14;

export default function MyDuties() {
  const today = dayjs().format("YYYY-MM-DD");
  const q = useQuery<Duty[]>({
    queryKey: ["roster-mine", today],
    queryFn: async () => (await axiosInstance.get("/roster/mine", { params: { from: today, days: DAYS } })).data.data,
  });

  const days = Array.from({ length: DAYS }, (_, i) => dayjs(today).add(i, "day"));
  const label = (d: dayjs.Dayjs) => (d.isSame(dayjs(today), "day") ? "Today" : d.isSame(dayjs(today).add(1, "day"), "day") ? "Tomorrow" : d.format("dddd"));
  const onDuty = (q.data ?? []).length;

  return (
    <Box>
      <PageHeader title="My duties" subtitle="Your shifts for the next two weeks, as the ward's roster has them." />
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {q.isLoading ? (
          <Box sx={{ p: 2.5, display: "grid", gap: 1.5 }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={36} />)}</Box>
        ) : q.isError ? (
          <ErrorState message={apiErrorText(q.error) ?? "Couldn't load your duties"} onRetry={() => q.refetch()} />
        ) : (
          <>
            {onDuty === 0 && (
              <Typography variant="body2" sx={{ px: 2.5, py: 1.5, color: "text.secondary" }}>
                No shifts on the roster for you in the next two weeks. Your in-charge plans the roster.
              </Typography>
            )}
            {days.map((d) => {
              const date = d.format("YYYY-MM-DD");
              const mine = (q.data ?? []).filter((x) => x.dutyDate === date);
              const isToday = date === today;
              return (
                <Box key={date} sx={{
                  display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 1, alignItems: "center",
                  px: 2.5, py: 1.5, borderTop: "1px solid", borderColor: "divider",
                  bgcolor: isToday ? `${BRAND.action}0D` : undefined,
                }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 600 }}>{label(d)}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{d.format("D MMM YYYY")}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {mine.length === 0 ? (
                      <Typography variant="body2" sx={{ color: "text.disabled" }}>Off</Typography>
                    ) : mine.map((x) => (
                      <Chip key={x.shiftName} variant="outlined"
                        label={`${x.shiftName} · ${x.shiftStart}–${x.shiftEnd} · ${x.wardName}`}
                        sx={{ fontWeight: 600, borderColor: BRAND.action, color: BRAND.action }} />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Paper>
    </Box>
  );
}

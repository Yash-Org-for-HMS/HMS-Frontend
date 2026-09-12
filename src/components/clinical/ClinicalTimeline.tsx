import { useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

/**
 * The patient's whole clinical story in one date-sorted, type-filterable feed:
 * visits, prescriptions, labs, imaging, vitals, admissions, surgeries and
 * nursing notes, merged.
 *
 * Lives here rather than inside the doctor's profile because it is read from
 * several panels now - the theatre and the ward need it as much as the clinic
 * does. `basePath` picks the mount: doctors read their own, everyone else reads
 * /clinical/patients, which is gated to the ward-clinical roles. Same handler
 * behind both, so there is one version of what a patient's history is.
 *
 * Fetches once and filters client-side; counts come from the full (uncapped)
 * set, so a chip never under-reports because a filter is already applied.
 */

// Event-type metadata for the unified clinical timeline (label + dot colour).
const TL_META: Record<string, { label: string; color: string }> = {
  VISIT: { label: "Visits", color: "#2563eb" },
  MEDICATION: { label: "Meds", color: "#8b5cf6" },
  LAB: { label: "Labs", color: "#0891b2" },
  IMAGING: { label: "Imaging", color: "#0e7490" },
  VITALS: { label: "Vitals", color: "#16a34a" },
  ADMISSION: { label: "Admissions", color: "#b45309" },
  SURGERY: { label: "Surgery", color: "#db2777" },
  NURSING_NOTE: { label: "Nursing", color: "#64748b" },
};

export interface TimelineEvent {
  at: string;
  type: string;
  title: string;
  summary: string | null;
  sourceId: string;
  doctor: string | null;
}

export default function ClinicalTimeline({
  patientId,
  basePath = "/doctor/patients",
}: {
  patientId: string;
  /** Which mount to read. Doctors have their own; the ward reads /clinical/patients. */
  basePath?: string;
}) {
  const [type, setType] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    // basePath is part of the key: the same patient read through a different
    // mount is a different request, and sharing a cache entry across them would
    // let one panel serve another panel's 403.
    queryKey: ["clinical-timeline", basePath, patientId],
    queryFn: async () => (await axiosInstance.get(`${basePath}/${patientId}/clinical-timeline`)).data.data,
    enabled: !!patientId,
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        This patient&apos;s history could not be loaded.
      </Typography>
    );
  }

  const counts: Record<string, number> = data?.counts ?? {};
  const all: TimelineEvent[] = data?.events ?? [];
  if (!all.length) {
    return <Typography variant="body2" sx={{ color: "text.secondary" }}>No clinical events on record yet.</Typography>;
  }
  const events = type ? all.filter((e) => e.type === type) : all;
  const chipSx = (active: boolean, color: string) => ({
    height: 24, fontWeight: 700, fontSize: "0.68rem", cursor: "pointer",
    ...(active ? { bgcolor: color, color: "#fff" } : {}),
  });

  return (
    <>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
        <Chip label={`All (${data.total})`} size="small" onClick={() => setType(null)}
          variant={type === null ? "filled" : "outlined"} sx={chipSx(type === null, "#2563eb")} />
        {Object.keys(TL_META).filter((t) => counts[t]).map((t) => (
          <Chip key={t} label={`${TL_META[t].label} (${counts[t]})`} size="small" onClick={() => setType(t)}
            variant={type === t ? "filled" : "outlined"} sx={chipSx(type === t, TL_META[t].color)} />
        ))}
      </Box>
      <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", top: 6, bottom: 6, left: 15, width: 2, bgcolor: "divider" } }}>
        {events.map((e, i) => {
          const m = TL_META[e.type] ?? { label: e.type, color: "#64748b" };
          return (
            <Box key={`${e.sourceId}-${i}`} sx={{ position: "relative", mb: 2.25, pl: 3, "&:last-child": { mb: 0 } }}>
              <Box sx={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: "50%", bgcolor: m.color, boxShadow: (t) => `0 0 0 3px ${t.palette.background.paper}`, zIndex: 1 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {new Date(e.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </Typography>
                <Chip label={m.label} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: `${m.color}1f`, color: m.color }} />
                {e.doctor && <Typography variant="caption" sx={{ color: "text.disabled" }}>· Dr. {e.doctor}</Typography>}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.title}</Typography>
              {e.summary && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{e.summary}</Typography>}
            </Box>
          );
        })}
      </Box>
    </>
  );
}

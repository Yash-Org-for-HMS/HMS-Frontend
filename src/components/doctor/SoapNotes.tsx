import { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { typeScale } from "@/styles/typography";
import { sanitizeRichText } from "@/utils/sanitizeHtml";
import { stripHtml } from "@/utils/format";

const SECTIONS = [
  { key: "soapSubjective", label: "Subjective" },
  { key: "soapObjective", label: "Objective" },
  { key: "soapAssessment", label: "Assessment" },
  { key: "soapPlan", label: "Plan" },
] as const;

type SoapFields = Partial<Record<(typeof SECTIONS)[number]["key"], string | null>>;

/**
 * A past visit's SOAP note, all four sections.
 *
 * History used to show the Assessment alone, so what a doctor wrote under
 * Subjective, Objective and Plan was saved and then never seen again — the
 * doctor at the next visit had no way to read last time's complaint, findings
 * or plan. Sections left empty are skipped rather than drawn as blank labels.
 *
 * `compact` is for the narrow History panel beside a live consultation: each
 * section is cut to a few lines until the doctor asks for the full note.
 */
export default function SoapNotes({ note, compact = false, emptyText }: {
  note: SoapFields;
  compact?: boolean;
  /** Shown when all four are empty. Omit to render nothing. */
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const filled = SECTIONS.filter((s) => stripHtml(note[s.key]).trim());

  if (!filled.length) {
    return emptyText
      ? <Typography variant="caption" sx={{ color: "text.secondary" }}>{emptyText}</Typography>
      : null;
  }

  // Only offer "full notes" when a section is long enough to be cut: three
  // lines of the narrow panel hold roughly a hundred characters.
  const long = filled.some((s) => stripHtml(note[s.key]).length > 100);
  const clamp = compact && long && !expanded;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {filled.map((s) => (
        <Box key={s.key}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", display: "block" }}>
            {s.label}
          </Typography>
          <Box
            sx={{
              color: "text.secondary", ...typeScale.body, lineHeight: 1.5,
              "& p": { m: 0 }, "& ul, & ol": { my: 0, pl: 2.5 },
              ...(clamp ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(note[s.key] ?? "") }}
          />
        </Box>
      ))}
      {compact && long && (
        <Button size="small" onClick={() => setExpanded((v) => !v)}
          sx={{ alignSelf: "flex-start", textTransform: "none", p: 0, minWidth: 0, fontWeight: 600 }}>
          {expanded ? "Show less" : "Show full notes"}
        </Button>
      )}
    </Box>
  );
}

/**
 * Order priority for lab and radiology.
 *
 * The `priorities` lookup table exists in the schema — with a colorHex column,
 * like every other status lookup — but it has NO ROWS. The ordering dialog has
 * always hardcoded these three values, and orders on file carry priorityId 1 and
 * 2 against a table that cannot explain them. So this mirrors what the ordering
 * UI actually writes, rather than reading a lookup that would return nothing.
 *
 * If the table is ever seeded, this is the one place to switch over.
 */
export const PRIORITY = {
  ROUTINE: 1,
  URGENT: 2,
  STAT: 3,
} as const;

export interface PriorityMeta {
  label: string;
  /** Red for anything that jumps the queue; routine work needs no colour. */
  color: string | null;
}

const META: Record<number, PriorityMeta> = {
  [PRIORITY.ROUTINE]: { label: "Routine", color: null },
  [PRIORITY.URGENT]: { label: "Urgent", color: "#dc2626" },
  [PRIORITY.STAT]: { label: "STAT", color: "#b91c1c" },
};

/**
 * Anything above routine. A missing priorityId means routine — 24 of the orders
 * on file have none, and an unset value must not read as an emergency.
 */
export const isUrgent = (priorityId?: number | null): boolean =>
  priorityId != null && priorityId >= PRIORITY.URGENT;

export const priorityMeta = (priorityId?: number | null): PriorityMeta | null =>
  priorityId != null ? META[priorityId] ?? null : null;

/**
 * The row styling for an urgent order: a red left edge, which reads down a long
 * table far better than a full border, plus a tint so the row itself stands out
 * when the eye is scanning the middle columns rather than the margin.
 *
 * Never the only signal — the label chip beside it carries the same information
 * for anyone who cannot separate the colours.
 */
export const urgentRowSx = (priorityId?: number | null) => {
  const meta = priorityMeta(priorityId);
  if (!isUrgent(priorityId) || !meta?.color) return {};
  return {
    borderLeft: `4px solid ${meta.color}`,
    bgcolor: `${meta.color}0a`,
    "&:hover": { bgcolor: `${meta.color}14` },
  };
};

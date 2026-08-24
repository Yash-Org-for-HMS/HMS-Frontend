import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Box, Paper, List, ListItemButton, ListItemText, Collapse, Divider, Chip } from "@mui/material";
import { ExpandLessRounded, ExpandMoreRounded } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { BRAND } from "@/styles/accents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportItem = { key: string; label: string; Comp: ComponentType<any> };
export type ReportGroup = { heading: string; items: ReportItem[] };

interface Props {
  title: string;
  subtitle?: string;
  /**
   * Already filtered by the caller. Module/role gating differs per panel (and
   * the super-admin panel has no hospital context at all), so this component
   * deliberately does no filtering of its own.
   */
  groups: ReportGroup[];
  /** Panel accent for the selected item. Defaults to the app action colour. */
  accent?: string;
  /** Optional key to open on first render; defaults to the first item. */
  initialKey?: string;
  /** Rendered in the page header's action slot (e.g. a fetching indicator). */
  actions?: ReactNode;
  /**
   * Rendered full-width between the header and the picker. Used by panels whose
   * reports share one date range / one fetch.
   */
  toolbar?: ReactNode;
  /**
   * Passed to the active report. Panels that fetch once and slice the payload
   * (nurse, doctor) hand the data down here; panels whose reports fetch for
   * themselves leave it undefined.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: Record<string, any>;
  /**
   * Shown in the content pane INSTEAD of the active report — a skeleton while
   * a shared fetch is in flight, or an error state. The picker stays visible so
   * the page doesn't collapse to nothing while loading.
   */
  contentState?: ReactNode;
}

/**
 * The shared shell for every reports page: a grouped, collapsible picker on the
 * left and the selected report on the right.
 *
 * Each panel used to carry its own copy of this — four near-identical
 * implementations, plus three panels still on a tab bar — so the reports pages
 * looked and behaved differently depending on which one you opened.
 */
export default function ReportNavLayout({
  title, subtitle, groups, accent = BRAND.action, initialKey,
  actions, toolbar, componentProps, contentState,
}: Props) {
  const firstKey = groups[0]?.items[0]?.key ?? "";

  /**
   * The open report lives in the URL (`?view=`), so a report can be linked to,
   * bookmarked and reached by the back button — and so a dashboard figure can
   * hand off to the register that explains it, carrying its filter along.
   *
   * Falls back to the caller's initialKey, so a panel that never sets `view`
   * behaves exactly as before.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const known = groups.some((g) => g.items.some((i) => i.key === viewParam));
  const active = known && viewParam ? viewParam : (initialKey ?? firstKey);

  const selectReport = (key: string) => {
    // Replace rather than merge: the previous report's filters mean nothing to
    // the next one, and leaving them behind would silently pre-filter it.
    setSearchParams({ view: key });
  };

  // The active report may live in a group that a later filter removed (module
  // switched off, role changed). Fall back to the first available item rather
  // than rendering an empty pane.
  const ActiveComp = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((i) => i.key === active);
      if (found) return found.Comp;
    }
    return groups[0]?.items[0]?.Comp;
  }, [active, groups]);

  // Only what the user has explicitly toggled. Anything absent falls back to
  // "open if it holds the active report" at render time, so arriving on a
  // report by URL expands its group — the previous version computed this once
  // at mount, which left the target group collapsed and the pane looking empty
  // when a link pointed into it.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (heading: string, current: boolean) => setOpen((o) => ({ ...o, [heading]: !current }));

  return (
    <Box>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {toolbar}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, alignItems: "flex-start" }}>
        {/* Report picker */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: "100%", md: 260 }, flexShrink: 0, borderRadius: 3,
            border: "1px solid", borderColor: "divider",
            position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden",
          }}
        >
          <List dense disablePadding>
            {groups.map((g, gi) => {
              const hasActive = g.items.some((i) => i.key === active);
              const isOpen = open[g.heading] ?? hasActive;
              return (
                <Box key={g.heading}>
                  {gi > 0 && <Divider />}
                  <ListItemButton onClick={() => toggle(g.heading, isOpen)} sx={{ py: 0.75, "&:hover": { bgcolor: "action.hover" } }}>
                    <ListItemText
                      primary={g.heading}
                      primaryTypographyProps={{
                        fontWeight: 800, fontSize: "0.7rem", letterSpacing: 0.5,
                        textTransform: "uppercase",
                        color: hasActive && !isOpen ? accent : "text.secondary",
                      }}
                    />
                    {/* Collapsed group still holding the active report keeps a marker. */}
                    {!isOpen && hasActive && (
                      <Chip size="small" label="•" sx={{ height: 16, width: 16, mr: 0.5, bgcolor: `${accent}22`, color: accent, "& .MuiChip-label": { p: 0, fontWeight: 900 } }} />
                    )}
                    {isOpen
                      ? <ExpandLessRounded fontSize="small" sx={{ color: "text.secondary" }} />
                      : <ExpandMoreRounded fontSize="small" sx={{ color: "text.secondary" }} />}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    {g.items.map((it) => (
                      <ListItemButton
                        key={it.key}
                        selected={active === it.key}
                        onClick={() => selectReport(it.key)}
                        sx={{
                          py: 0.75, pl: 2.5,
                          "&.Mui-selected": { bgcolor: `${accent}14`, borderRight: `3px solid ${accent}` },
                          "&.Mui-selected:hover": { bgcolor: `${accent}22` },
                        }}
                      >
                        <ListItemText
                          primary={it.label}
                          primaryTypographyProps={{
                            fontSize: "0.86rem",
                            fontWeight: active === it.key ? 700 : 500,
                            color: active === it.key ? accent : "text.primary",
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Paper>

        {/* Active report */}
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          {contentState ?? (ActiveComp ? <ActiveComp {...(componentProps ?? {})} /> : null)}
        </Box>
      </Box>
    </Box>
  );
}

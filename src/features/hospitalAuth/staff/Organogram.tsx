import { useMemo, useRef, useState, useLayoutEffect, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Autocomplete, TextField, MenuItem,
  Drawer, Divider, Chip, Collapse, Stack,
} from "@mui/material";
import {
  ZoomInRounded, ZoomOutRounded, CenterFocusStrongRounded, UnfoldMoreRounded, UnfoldLessRounded, ExpandMoreRounded,
  SyncAltRounded, CloseRounded, EditRounded, SearchRounded, WarningAmberRounded, AccountTreeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { BRAND, NEUTRAL, SEMANTIC } from "@/styles/accents";
import { apiErrorText } from "@/utils/apiError";
import {
  buildForest, splitUnplaced, ancestorsOf, openToDepth, departmentLanes, colorOf, initialsOf, managerOf, ROLE_SHORT,
  type OrgChartData, type OrgPerson, type OrgNode, type Line, type DeptCard, type DeptMember,
} from "./orgChart";

/**
 * The organisation chart (organogram): who reports to whom, and how the
 * departments sit under the people who oversee them — read from the Staff
 * Directory, so changing a reporting line or a department there changes it
 * here. No fixed shape: whoever has no manager is a top.
 */

const CARD_W = 232;
const LINE = `1.5px solid ${NEUTRAL.line}`;

// ── A person ───────────────────────────────────────────────────────────────

function Avatar({ p, size = 40 }: { p: OrgPerson; size?: number }) {
  return (
    <Box aria-hidden sx={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
      bgcolor: `${colorOf(p.categoryCode)}1f`, color: colorOf(p.categoryCode), fontWeight: 800, fontSize: size * 0.36, letterSpacing: 0.3,
    }}>
      {initialsOf(p.name)}
    </Box>
  );
}

/** "Head · Orthopaedics" for the home department; the rest as "+2" with the list on hover. */
function DeptLine({ p }: { p: OrgPerson }) {
  const home = p.departments.find((d) => d.isHome);
  const others = p.departments.filter((d) => !d.isHome);
  if (!home && !others.length) return <Typography variant="caption" sx={{ color: "text.disabled" }}>No department</Typography>;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      {home && (
        <Typography variant="caption" noWrap sx={{ color: "text.secondary", minWidth: 0 }}>
          {home.roleInDept === "HOD" || home.roleInDept === "DEPUTY_HOD" ? <Box component="b" sx={{ color: BRAND.actionDark }}>{ROLE_SHORT[home.roleInDept]} · </Box> : null}
          {home.departmentName}
        </Typography>
      )}
      {others.length > 0 && (
        <Tooltip title={<Box>{others.map((d) => <div key={d.departmentId}>{d.departmentName} — {ROLE_SHORT[d.roleInDept] ?? d.roleInDept}</div>)}</Box>}>
          <Chip
            size="small" icon={<SyncAltRounded sx={{ fontSize: "14px !important" }} />} label={`+${others.length}`}
            aria-label={`Also in ${others.map((d) => d.departmentName).join(", ")}`}
            sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${BRAND.action}14`, color: BRAND.actionDark, "& .MuiChip-icon": { color: BRAND.actionDark, ml: 0.5 } }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

function PersonCard({ p, onOpen, highlighted, dimmed, line, byId, showBranch, footer, compact = false }: {
  p: OrgPerson; onOpen: (p: OrgPerson) => void; highlighted: boolean; dimmed: boolean; line: Line;
  byId: Map<string, OrgPerson>; showBranch: boolean; footer?: ReactNode; compact?: boolean;
}) {
  // In the HR view, a different day-to-day manager is said on the card (a dotted line, in words).
  const daily = line === "hr" && p.functionalManagerId && p.functionalManagerId !== p.adminManagerId ? byId.get(p.functionalManagerId) : null;
  return (
    <Box
      id={`org-card-${p.staffId}`} data-org-card role="button" tabIndex={0}
      aria-label={`${p.name}${p.designation ? `, ${p.designation}` : ""}`}
      onClick={() => onOpen(p)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      sx={{
        width: CARD_W, bgcolor: "background.paper", borderRadius: 3, border: "1px solid", textAlign: "left", cursor: "pointer",
        borderColor: highlighted ? BRAND.action : "divider",
        boxShadow: highlighted ? `0 0 0 3px ${BRAND.action}33, 0 6px 18px rgba(15,23,42,0.08)` : "0 1px 2px rgba(15,23,42,0.06)",
        opacity: dimmed ? 0.35 : 1, transition: "box-shadow .15s, opacity .15s, transform .15s",
        "&:hover": { boxShadow: "0 6px 18px rgba(15,23,42,0.10)", transform: "translateY(-1px)" },
        "&:focus-visible": { outline: `2px solid ${BRAND.action}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, p: compact ? 1 : 1.5, alignItems: "center" }}>
        <Avatar p={p} size={compact ? 32 : 40} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {p.name}
          </Typography>
          <Typography variant="caption" noWrap component="div" sx={{ color: "text.secondary" }}>
            {p.designation ?? p.category}{p.grade != null ? ` · G${p.grade}` : ""}
          </Typography>
          {!compact && <DeptLine p={p} />}
        </Box>
      </Box>
      {!compact && (daily || showBranch || p.managerLeft) && (
        <Box sx={{ px: 1.5, pb: 1, mt: -0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
          {daily && <Typography variant="caption" noWrap sx={{ color: "text.secondary", borderTop: `1px dashed ${NEUTRAL.line}`, pt: 0.5 }}>Day to day: {daily.name}</Typography>}
          {showBranch && p.branches.length > 0 && <Typography variant="caption" noWrap sx={{ color: "text.disabled" }}>{p.branches.join(" · ")}</Typography>}
          {p.managerLeft && <Typography variant="caption" sx={{ color: SEMANTIC.warningDark, fontWeight: 700 }}>Their manager has left</Typography>}
        </Box>
      )}
      {footer}
    </Box>
  );
}

// ── The reporting tree ─────────────────────────────────────────────────────

interface TreeProps {
  open: Set<string>; toggle: (id: string) => void; onOpen: (p: OrgPerson) => void;
  focus: string | null; highlightDept: string; line: Line; byId: Map<string, OrgPerson>; showBranch: boolean;
}

const inDept = (p: OrgPerson, dept: string) => p.departments.some((d) => d.departmentId === dept);

/** Lines joining a parent to its row of children (the classic organogram connectors). */
const childSx = {
  position: "relative" as const, px: 1.25, pt: 3, display: "flex", flexDirection: "column" as const, alignItems: "center",
  "&::before, &::after": { content: '""', position: "absolute", top: 0, right: "50%", width: "50%", height: 24, borderTop: LINE },
  "&::after": { right: "auto", left: "50%", borderLeft: LINE },
  "&:only-of-type::before, &:only-of-type::after": { display: "none" },
  "&:only-of-type": { pt: 0 },
  "&:first-of-type::before, &:last-of-type::after": { border: 0 },
  "&:last-of-type::before": { borderRight: LINE, borderTopRightRadius: 10 },
  "&:first-of-type::after": { borderTopLeftRadius: 10 },
};

function Branch({ node, ...t }: TreeProps & { node: OrgNode }) {
  const p = node.person;
  const isOpen = t.open.has(p.staffId);
  // Those with people of their own spread sideways; a team with nobody under
  // them stacks in one column, so a big team does not make the chart a mile wide.
  const managers = node.children.filter((c) => c.children.length);
  const team = node.children.filter((c) => !c.children.length);
  const footer = node.children.length > 0 ? (
    <Button
      size="small" fullWidth onClick={(e) => { e.stopPropagation(); t.toggle(p.staffId); }}
      aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} the ${node.size} people under ${p.name}`}
      endIcon={<ExpandMoreRounded sx={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
      sx={{ borderTop: "1px solid", borderColor: "divider", borderRadius: "0 0 12px 12px", textTransform: "none", fontWeight: 700, fontSize: 12, color: "text.secondary", py: 0.25 }}
    >
      {node.children.length} direct · {node.size} in all
    </Button>
  ) : undefined;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <PersonCard
        p={p} onOpen={t.onOpen} line={t.line} byId={t.byId} showBranch={t.showBranch} footer={footer}
        highlighted={t.focus === p.staffId || (!!t.highlightDept && inDept(p, t.highlightDept))}
        dimmed={!!t.highlightDept && !inDept(p, t.highlightDept)}
      />
      {isOpen && node.children.length > 0 && (
        <Box sx={{ position: "relative", display: "flex", justifyContent: "center", pt: 3, "&::before": { content: '""', position: "absolute", top: 0, left: "50%", height: 24, borderLeft: LINE } }}>
          {team.length > 0 && (
            <Box sx={childSx}>
              <Stack spacing={1} sx={{ p: 1, borderRadius: 3, bgcolor: `${NEUTRAL.subtle}`, border: `1px dashed ${NEUTRAL.line}` }}>
                {team.map((c) => (
                  <PersonCard key={c.person.staffId} p={c.person} compact onOpen={t.onOpen} line={t.line} byId={t.byId} showBranch={t.showBranch}
                    highlighted={t.focus === c.person.staffId || (!!t.highlightDept && inDept(c.person, t.highlightDept))}
                    dimmed={!!t.highlightDept && !inDept(c.person, t.highlightDept)} />
                ))}
              </Stack>
            </Box>
          )}
          {managers.map((c) => (
            <Box key={c.person.staffId} sx={childSx}><Branch node={c} {...t} /></Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * The chart's canvas: drag the background to move around, zoom with the
 * controls in its corner (or fit the whole chart). Scrollbars and the keyboard
 * still work as on any page.
 */
function Canvas({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const centred = useRef(false);
  /** The point (in unzoomed chart units) to keep in the middle of the view across a zoom. */
  const keep = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Opens on the top of the chart: centred across, at the top.
  useLayoutEffect(() => {
    const o = outer.current;
    if (!o || !size.w || centred.current) return;
    o.scrollLeft = Math.max(0, (o.scrollWidth - o.clientWidth) / 2);
    centred.current = true;
  }, [size.w]);
  // A zoom keeps the middle of the view where it was.
  useLayoutEffect(() => {
    const o = outer.current;
    if (!o || !keep.current) return;
    o.scrollLeft = keep.current.x * zoom - o.clientWidth / 2;
    o.scrollTop = keep.current.y * zoom - o.clientHeight / 2;
    keep.current = null;
  }, [zoom]);
  const zoomTo = (next: number) => {
    const o = outer.current;
    if (o) keep.current = { x: (o.scrollLeft + o.clientWidth / 2) / zoom, y: (o.scrollTop + o.clientHeight / 2) / zoom };
    setZoom(Math.max(0.3, Math.min(1.5, +next.toFixed(2))));
  };
  const fit = () => {
    if (outer.current && size.w) setZoom(Math.max(0.3, Math.min(1, +((outer.current.clientWidth - 24) / size.w).toFixed(2))));
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-org-card], button, a, input")) return;
    drag.current = { x: e.clientX, y: e.clientY, left: outer.current!.scrollLeft, top: outer.current!.scrollTop };
    outer.current!.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !outer.current) return;
    outer.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    outer.current.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };
  const up = () => { drag.current = null; setDragging(false); };
  return (
    <Box sx={{ position: "relative" }}>
      <Box
        ref={outer} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        sx={{
          height: { xs: "65vh", md: "calc(100vh - 330px)" }, minHeight: 440, overflow: "auto", borderRadius: 3, border: "1px solid", borderColor: "divider",
          cursor: dragging ? "grabbing" : "grab", touchAction: "none",
          bgcolor: "#f8fafc", backgroundImage: `radial-gradient(${NEUTRAL.line} 1px, transparent 1px)`, backgroundSize: "18px 18px",
        }}
      >
        <Box sx={{ width: size.w * zoom, height: size.h * zoom, mx: "auto", position: "relative" }}>
          <Box ref={inner} sx={{ position: "absolute", top: 0, left: 0, width: "max-content", p: 3, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
            {children}
          </Box>
        </Box>
      </Box>
      <Paper elevation={3} sx={{ position: "absolute", right: 12, bottom: 12, display: "flex", alignItems: "center", borderRadius: 2, px: 0.25 }}>
        <Tooltip title="Zoom out"><IconButton size="small" aria-label="Zoom out" onClick={() => zoomTo(zoom - 0.1)}><ZoomOutRounded fontSize="small" /></IconButton></Tooltip>
        <Typography variant="caption" sx={{ width: 40, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{Math.round(zoom * 100)}%</Typography>
        <Tooltip title="Zoom in"><IconButton size="small" aria-label="Zoom in" onClick={() => zoomTo(zoom + 0.1)}><ZoomInRounded fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Fit the whole chart"><IconButton size="small" aria-label="Fit the whole chart" onClick={fit}><CenterFocusStrongRounded fontSize="small" /></IconButton></Tooltip>
      </Paper>
    </Box>
  );
}

// ── The departments view ───────────────────────────────────────────────────

function MemberRow({ m, onOpen, note }: { m: DeptMember; onOpen: (p: OrgPerson) => void; note?: string }) {
  return (
    <Box
      role="button" tabIndex={0} onClick={() => onOpen(m.person)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(m.person); }}
      sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, px: 1, borderRadius: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: `2px solid ${BRAND.action}` } }}
    >
      <Avatar p={m.person} size={26} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{m.person.name}</Typography>
        <Typography variant="caption" noWrap component="div" sx={{ color: "text.secondary" }}>{note ?? m.person.designation ?? m.person.category}</Typography>
      </Box>
    </Box>
  );
}

function DepartmentCard({ card, onOpen }: { card: DeptCard; onOpen: (p: OrgPerson) => void }) {
  const [open, setOpen] = useState(false);
  const count = card.members.length + card.deputies.length + card.visitors.length + card.heads.length;
  const homeOf = (p: OrgPerson) => p.departments.find((d) => d.isHome)?.departmentName;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{card.department.departmentName}</Typography>
        {card.department.group && <Typography variant="caption" sx={{ color: "text.secondary" }}>{card.department.group}</Typography>}
        <Box sx={{ mt: 1.5 }}>
          {card.heads.length ? card.heads.map((h) => (
            <MemberRow key={h.staffId} m={{ person: h, roleInDept: "HOD", isHome: true }} onOpen={onOpen}
              note={`Head${h.departments.find((d) => d.departmentId === card.department.departmentId)?.isHome ? "" : ` · also heads ${homeOf(h) ?? "another department"}`}`} />
          )) : (
            <Typography variant="body2" sx={{ color: SEMANTIC.warningDark, display: "flex", alignItems: "center", gap: 0.5, px: 1 }}>
              <WarningAmberRounded fontSize="small" /> No head on file
            </Typography>
          )}
          {card.deputies.map((d) => <MemberRow key={d.person.staffId} m={d} onOpen={onOpen} note="Deputy head" />)}
        </Box>
      </Box>
      <Button
        fullWidth size="small" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        endIcon={<ExpandMoreRounded sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
        sx={{ borderTop: "1px solid", borderColor: "divider", borderRadius: 0, textTransform: "none", justifyContent: "space-between", px: 2, color: "text.secondary", fontWeight: 600 }}
      >
        {count} {count === 1 ? "person" : "people"}{card.visitors.length ? ` · ${card.visitors.length} from other departments` : ""}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ p: 1, pt: 0.5 }}>
          {card.members.length > 0 && <Typography variant="overline" sx={{ px: 1, color: "text.secondary" }}>Team</Typography>}
          {card.members.map((m) => <MemberRow key={m.person.staffId} m={m} onOpen={onOpen} note={m.roleInDept === "VISITING" ? `Visiting · ${m.person.designation ?? m.person.category}` : undefined} />)}
          {card.visitors.length > 0 && (
            <>
              <Typography variant="overline" sx={{ px: 1, color: BRAND.actionDark, display: "flex", alignItems: "center", gap: 0.5 }}><SyncAltRounded sx={{ fontSize: 14 }} /> From other departments</Typography>
              {card.visitors.map((m) => <MemberRow key={m.person.staffId} m={m} onOpen={onOpen} note={`${ROLE_SHORT[m.roleInDept] ?? m.roleInDept} · home: ${homeOf(m.person) ?? "none"}`} />)}
            </>
          )}
          {!card.members.length && !card.visitors.length && <Typography variant="body2" sx={{ color: "text.secondary", px: 1, py: 1 }}>Nobody else on file.</Typography>}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── The person's panel ─────────────────────────────────────────────────────

function PersonPanel({ p, data, line, onClose, onPick }: { p: OrgPerson; data: OrgChartData; line: Line; onClose: () => void; onPick: (p: OrgPerson) => void }) {
  const navigate = useNavigate();
  const byId = new Map(data.people.map((x) => [x.staffId, x]));
  const hr = p.adminManagerId ? byId.get(p.adminManagerId) : null;
  const daily = p.functionalManagerId ? byId.get(p.functionalManagerId) : null;
  const reports = data.people.filter((x) => managerOf(x, line) === p.staffId).sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99));
  const person = (x: OrgPerson, label?: string) => (
    <MemberRow key={x.staffId} m={{ person: x, roleInDept: "MEMBER", isHome: true }} onOpen={onPick} note={label ?? x.designation ?? x.category} />
  );
  return (
    <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2.5 }} role="dialog" aria-label={`${p.name} — details`}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Avatar p={p} size={52} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{p.name}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>{p.designation ?? "No designation"}{p.grade != null ? ` · Grade ${p.grade}` : ""}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.category}{p.branches.length ? ` · ${p.branches.join(", ")}` : ""}{p.hasLogin ? "" : " · no login"}</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose}><CloseRounded /></IconButton>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="overline" sx={{ color: "text.secondary" }}>Reports to</Typography>
      {hr ? person(hr, `HR manager · ${hr.designation ?? hr.category}`) :<Typography variant="body2" sx={{ color: p.managerLeft ? SEMANTIC.warningDark : "text.secondary", px: 1 }}>{p.managerLeft ? "Their manager has left — set a new one" : "Nobody — top of the organisation"}</Typography>}
      {daily && daily.staffId !== hr?.staffId && person(daily, `Day to day · ${daily.designation ?? daily.category}`)}
      <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>Departments</Typography>
      {p.departments.length ? p.departments.map((d) => (
        <Box key={d.departmentId} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: d.isHome ? 700 : 500 }}>{d.departmentName}</Typography>
          <Chip size="small" label={ROLE_SHORT[d.roleInDept] ?? d.roleInDept} sx={{ fontWeight: 700, ...(d.roleInDept === "HOD" ? { bgcolor: `${BRAND.action}1a`, color: BRAND.actionDark } : {}) }} />
          {d.isHome ? <Chip size="small" variant="outlined" label="Home" /> : <Chip size="small" variant="outlined" icon={<SyncAltRounded sx={{ fontSize: "14px !important" }} />} label="Also" />}
        </Box>
      )) : <Typography variant="body2" sx={{ color: "text.secondary", px: 1 }}>None on file</Typography>}
      {p.posting && <Typography variant="body2" sx={{ px: 1, mt: 0.5, color: "text.secondary" }}>Posted to {p.posting}</Typography>}
      <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>{line === "hr" ? "Reporting to them" : "Day to day under them"} ({reports.length})</Typography>
      {reports.length ? reports.map((x) => person(x)) :<Typography variant="body2" sx={{ color: "text.secondary", px: 1 }}>Nobody</Typography>}
      <Button fullWidth variant="outlined" startIcon={<EditRounded />} sx={{ mt: 2.5, textTransform: "none", fontWeight: 700 }}
        onClick={() => navigate(`/hospital/staff?edit=${p.staffId}`)}>
        Change in the Staff Directory
      </Button>
    </Box>
  );
}

// ── The page ───────────────────────────────────────────────────────────────

export default function Organogram() {
  const navigate = useNavigate();
  const q = useQuery<OrgChartData>({
    queryKey: ["org-chart"],
    queryFn: async () => (await axiosInstance.get("/hospital/staff/org-chart")).data.data,
  });
  const data = q.data;
  const [view, setView] = useState<"tree" | "departments">("tree");
  const [line, setLine] = useState<Line>("hr");
  const [chosenOpen, setOpen] = useState<Set<string> | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [highlightDept, setHighlightDept] = useState("");
  const [panelFor, setPanelFor] = useState<OrgPerson | null>(null);

  const people = useMemo(() => data?.people ?? [], [data]);
  const byId = useMemo(() => new Map(people.map((p) => [p.staffId, p])), [people]);
  const forest = useMemo(() => buildForest(people, line), [people, line]);
  const { tops, unplaced } = useMemo(() => splitUnplaced(forest), [forest]);
  // At first: everything for a small organisation, two levels for a big one.
  const open = chosenOpen ?? openToDepth(tops, people.length <= 40 ? 99 : 2);
  const lanes = useMemo(() => (data ? departmentLanes(data, line) : []), [data, line]);
  const crossDept = people.reduce((n, p) => n + p.departments.filter((d) => !d.isHome).length, 0);
  const deptsInUse = (data?.departments ?? []).filter((d) => people.some((p) => inDept(p, d.departmentId)));
  const showBranch = (data?.branchCount ?? 0) > 1;

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
  };
  const reveal = (ids: string[]) => {
    const next = new Set(open);
    for (const id of ids) for (const a of ancestorsOf(people, id, line)) next.add(a);
    setOpen(next);
  };
  const scrollTo = (id: string) => setTimeout(() => document.getElementById(`org-card-${id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "center" }), 80);
  const find = (p: OrgPerson | null) => {
    if (!p) { setFocus(null); return; }
    setView("tree");
    reveal([p.staffId]);
    setFocus(p.staffId);
    scrollTo(p.staffId);
  };
  const pickDept = (id: string) => {
    setHighlightDept(id);
    if (id) reveal(people.filter((p) => inDept(p, id)).map((p) => p.staffId));
  };
  const allIds = () => new Set(people.filter((p) => people.some((x) => managerOf(x, line) === p.staffId)).map((p) => p.staffId));

  const treeProps = { open, toggle, onOpen: setPanelFor, focus, highlightDept, line, byId, showBranch };

  return (
    <Box sx={{ pb: 4 }}>
      <PageHeader
        title="Organisation chart"
        subtitle="Who reports to whom, and how departments sit under the people who oversee them. Built from the Staff Directory — change a reporting line or a department there."
        actions={<Button variant="outlined" startIcon={<AccountTreeRounded />} onClick={() => navigate("/hospital/staff")} sx={{ textTransform: "none", fontWeight: 700 }}>Staff Directory</Button>}
      />

      {q.isError ? <ErrorState title="Couldn't load the organisation chart" message={apiErrorText(q.error)} onRetry={() => q.refetch()} />
        : q.isLoading || !data ? <Box sx={{ py: 8, display: "grid", placeItems: "center" }}><HeartbeatLoader /></Box>
          : !people.length ? (
            <Paper sx={{ p: 4 }}>
              <Mascot pose="nothing-here-yet" title="Nobody in the Staff Directory yet" subtitle="Add people there, with their department and who they report to — the chart draws itself."
                action={<Button variant="contained" onClick={() => navigate("/hospital/staff")}>Open the Staff Directory</Button>} />
            </Paper>
          ) : (
            <>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                {[
                  [`${people.length}`, "people"],
                  [`${deptsInUse.length}`, "departments"],
                  [`${crossDept}`, "cross-department assignments"],
                  [`${tops.length}`, tops.length === 1 ? "top of the organisation" : "tops of the organisation"],
                ].map(([n, label]) => (
                  <Chip key={label} label={<><b>{n}</b> {label}</>} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", fontSize: 13 }} />
                ))}
                {unplaced.length > 0 && <Chip icon={<WarningAmberRounded />} label={<><b>{unplaced.length}</b> without a manager</>} sx={{ bgcolor: `${SEMANTIC.warning}1a`, color: SEMANTIC.warningDark, fontSize: 13, "& .MuiChip-icon": { color: SEMANTIC.warningDark } }} />}
              </Box>

              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", borderRadius: 3 }}>
                <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)} aria-label="View">
                  <ToggleButton value="tree" sx={{ textTransform: "none", fontWeight: 700 }}>Reporting lines</ToggleButton>
                  <ToggleButton value="departments" sx={{ textTransform: "none", fontWeight: 700 }}>Departments</ToggleButton>
                </ToggleButtonGroup>
                <ToggleButtonGroup size="small" exclusive value={line} onChange={(_e, v) => { if (v) { setLine(v); setOpen(null); } }} aria-label="Which manager">
                  <ToggleButton value="hr" sx={{ textTransform: "none" }}>HR manager</ToggleButton>
                  <ToggleButton value="daily" sx={{ textTransform: "none" }}>Day to day</ToggleButton>
                </ToggleButtonGroup>
                <Autocomplete
                  size="small" sx={{ width: 260 }} options={[...people].sort((a, b) => a.name.localeCompare(b.name))}
                  getOptionLabel={(p) => p.name} value={focus ? byId.get(focus) ?? null : null} onChange={(_e, p) => find(p)}
                  renderOption={(props, p) => (
                    <li {...props} key={p.staffId}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><Avatar p={p} size={26} />
                        <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography><Typography variant="caption" sx={{ color: "text.secondary" }}>{p.designation ?? p.category}</Typography></Box>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} placeholder="Find a person" slotProps={{ input: { ...params.InputProps, startAdornment: <SearchRounded fontSize="small" sx={{ color: "text.secondary", mr: 0.5 }} /> } }} />}
                />
                {view === "tree" && (
                  <TextField select size="small" id="org-highlight-dept" label="Highlight a department" value={highlightDept} onChange={(e) => pickDept(e.target.value)} sx={{ minWidth: 220 }}>
                    <MenuItem value="">None</MenuItem>
                    {deptsInUse.map((d) => <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>)}
                  </TextField>
                )}
                <Box sx={{ flex: 1 }} />
                {view === "tree" && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    <Tooltip title="Open everyone"><IconButton aria-label="Open everyone" onClick={() => setOpen(allIds())}><UnfoldMoreRounded /></IconButton></Tooltip>
                    <Tooltip title="Close to the tops"><IconButton aria-label="Close to the tops" onClick={() => setOpen(new Set())}><UnfoldLessRounded /></IconButton></Tooltip>
                  </Box>
                )}
              </Paper>

              {view === "tree" ? (
                <>
                  {tops.length ? (
                    <Canvas>
                      <Box sx={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                        {tops.map((n) => <Branch key={n.person.staffId} node={n} {...treeProps} />)}
                      </Box>
                    </Canvas>
                  ) : (
                    // Nobody has a manager on file yet: say how the chart starts, not an empty canvas.
                    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
                      <Mascot pose="nothing-here-yet" title="No reporting lines yet"
                        subtitle="Nobody has a manager on file. In the Staff Directory, set who each person reports to — start with the heads reporting to your CEO or medical director — and the chart draws itself."
                        action={<Button variant="contained" startIcon={<EditRounded />} onClick={() => navigate("/hospital/staff")} sx={{ textTransform: "none", fontWeight: 700 }}>Set reporting lines</Button>} />
                    </Paper>
                  )}
                  {unplaced.length > 0 && (
                    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, borderColor: `${SEMANTIC.warning}66`, bgcolor: `${SEMANTIC.warning}0a` }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Not placed in the hierarchy yet ({unplaced.length})</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>Nobody is set as their manager. Give them one in the Staff Directory and they join the chart.</Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1.5 }}>
                        {unplaced.map((p) => (
                          <PersonCard key={p.staffId} p={p} compact onOpen={setPanelFor} line={line} byId={byId} showBranch={showBranch}
                            highlighted={focus === p.staffId || (!!highlightDept && inDept(p, highlightDept))} dimmed={!!highlightDept && !inDept(p, highlightDept)} />
                        ))}
                      </Box>
                    </Paper>
                  )}
                </>
              ) : (
                <Stack spacing={3}>
                  {lanes.map((l) => (
                    <Box key={l.key}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                        {l.overseer ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} role="button" tabIndex={0}
                            onClick={() => setPanelFor(l.overseer)} onKeyDown={(e) => { if (e.key === "Enter") setPanelFor(l.overseer); }}>
                            <Avatar p={l.overseer} size={34} />
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{l.overseer.name}</Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>{l.overseer.designation ?? l.overseer.category} · oversees {l.departments.length} {l.departments.length === 1 ? "department" : "departments"}</Typography>
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: l.key === "nohead" ? SEMANTIC.warningDark : "text.primary" }}>
                            {l.label} <Typography component="span" variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>· {l.departments.length} {l.departments.length === 1 ? "department" : "departments"}</Typography>
                          </Typography>
                        )}
                        <Box sx={{ flex: 1, borderTop: LINE }} />
                      </Box>
                      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", alignItems: "start" }}>
                        {l.departments.map((card) => <DepartmentCard key={card.department.departmentId} card={card} onOpen={setPanelFor} />)}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}

      <Drawer anchor="right" open={!!panelFor} onClose={() => setPanelFor(null)}>
        {panelFor && data && <PersonPanel p={panelFor} data={data} line={line} onClose={() => setPanelFor(null)} onPick={(p) => setPanelFor(p)} />}
      </Drawer>
    </Box>
  );
}

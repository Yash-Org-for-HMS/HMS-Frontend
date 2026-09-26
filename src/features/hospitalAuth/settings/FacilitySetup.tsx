import { useState, useEffect, useMemo } from "react";
import type {
  IpdStructure, WardNode, RoomNode, BedNode, RoomClass, FacilityKind, FacilityEditTarget, SetupForm,
  RoomClassRent, RoomClassRentsResponse, FacilityOptions, ServiceUnit, Building, Floor,
} from "./facility.types";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Typography, Paper, Grid, Button, Chip, Menu, MenuItem, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Divider, Tooltip, InputAdornment,
  FormControlLabel, Switch,
} from "@mui/material";
import {
  HotelRounded, AddRounded, PersonRounded, MeetingRoomRounded, ApartmentRounded, EditRounded, PaymentsRounded, InfoOutlined,
  DomainRounded, LayersRounded, StorefrontRounded, PlaylistAddRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import SearchableSelect from "@/components/form/SearchableSelect";

const ACCENT = BRAND.action;

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: SEMANTIC.success, OCCUPIED: SEMANTIC.danger, RESERVED: SEMANTIC.warning, MAINTENANCE: NEUTRAL.muted,
};

const GENDER_LABEL: Record<string, string> = { MIXED: "Mixed", MALE: "Male only", FEMALE: "Female only" };
/** Which ward genders a ward type allows — mirrors facility.rules.ts allowedGenders. */
const gendersFor = (rule?: string | null) => (rule === "FEMALE_ONLY" ? ["FEMALE"] : rule === "ALLOWED" ? ["MIXED", "MALE", "FEMALE"] : ["MIXED"]);
const UNIT_KIND_LABEL: Record<string, string> = { OT: "Operation theatre", LAB: "Laboratory / imaging", OPD: "Outpatient clinic", COUNTER: "Desk / counter", UNIT: "Other service unit" };
/** Mirrors facility.rules.ts makeBedCode, for the preview under the field. */
const codePart = (s?: string | null) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const previewBedCode = (ward?: string | null, room?: string | null, bed?: string | null) => [codePart(ward) || "W", codePart(room) || "R", codePart(bed) || "B"].join("-");

// Ward/room/bed SETUP lives here (Hospital Admin) — day-to-day bed STATUS
// changes (available/reserved/maintenance) remain in the Reception panel's
// Bed Management screen, since that's operational, not configuration.
const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
    <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

type DialogState =
  | { kind: FacilityKind; edit?: FacilityEditTarget }
  | { kind: "bulk" }
  | { kind: "building"; edit?: Building }
  | { kind: "floor"; edit?: Floor }
  | { kind: "unit"; edit?: ServiceUnit };

export default function FacilitySetup() {
  const [setupAnchor, setSetupAnchor] = useState<null | HTMLElement>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [rentOpen, setRentOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<IpdStructure>({
    queryKey: ["ipd-structure"],
    queryFn: async () => (await axiosInstance.get("/ipd/structure")).data.data,
  });
  // The hospital's ward / room / bed types, departments and floors — what the forms pick from.
  const { data: options, refetch: refetchOptions } = useQuery<FacilityOptions>({
    queryKey: ["ipd-facility-options"],
    queryFn: async () => (await axiosInstance.get("/ipd/facility-options")).data.data,
  });
  const { data: units = [], refetch: refetchUnits } = useQuery<ServiceUnit[]>({
    queryKey: ["ipd-service-units"],
    queryFn: async () => (await axiosInstance.get("/ipd/service-units")).data.data,
  });
  const summary = data?.summary;
  const census = summary?.census;
  const wards: WardNode[] = data?.wards || [];

  // Beds carrying no pricing class. Derived here rather than asked of the API:
  // the ward tree already has every bed, and a second endpoint for a number the
  // page is holding would be a round trip for nothing.
  const unclassedBeds = wards.reduce(
    (n, w) => n + (w.rooms ?? []).reduce(
      (m, r) => m + (r.beds ?? []).filter((b) => !b.roomClassName && b.isPatientBed !== false && b.isActive !== false).length, 0), 0);

  // Active room classes (Schedule of Charges) — pickable per bed to drive room-wise
  // pricing of charges on the discharge bill.
  const { data: roomClasses = [] } = useQuery<RoomClass[]>({
    queryKey: ["soc-room-classes"],
    queryFn: async () => (await axiosInstance.get("/hospital/soc/room-classes")).data.data,
  });

  const done = () => { setDialog(null); refetch(); refetchOptions(); refetchUnits(); };
  const open = (d: DialogState) => { setSetupAnchor(null); setDialog(d); };

  return (
    <Box>
      <PageHeader
        title="Ward & Bed Setup"
        subtitle="Define the wards, rooms, and beds available for admission. Day-to-day bed status is managed from the Reception panel."
        actions={
          <>
            <Button variant="outlined" startIcon={<PaymentsRounded />} onClick={() => setRentOpen(true)}
              sx={{ textTransform: "none", mr: 1, borderColor: ACCENT, color: ACCENT }}>
              Room rent
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={(e) => setSetupAnchor(e.currentTarget)}
              sx={{ textTransform: "none"}}>Add</Button>
            <Menu anchorEl={setupAnchor} open={Boolean(setupAnchor)} onClose={() => setSetupAnchor(null)}>
              <MenuItem onClick={() => open({ kind: "ward" })}><ApartmentRounded fontSize="small" sx={{ mr: 1 }} /> Add ward</MenuItem>
              <MenuItem onClick={() => open({ kind: "room" })}><MeetingRoomRounded fontSize="small" sx={{ mr: 1 }} /> Add room</MenuItem>
              <MenuItem onClick={() => open({ kind: "bed" })}><HotelRounded fontSize="small" sx={{ mr: 1 }} /> Add bed</MenuItem>
              <MenuItem onClick={() => open({ kind: "bulk" })}><PlaylistAddRounded fontSize="small" sx={{ mr: 1 }} /> Add several beds</MenuItem>
              <Divider />
              <MenuItem onClick={() => open({ kind: "building" })}><DomainRounded fontSize="small" sx={{ mr: 1 }} /> Add building</MenuItem>
              <MenuItem onClick={() => open({ kind: "floor" })}><LayersRounded fontSize="small" sx={{ mr: 1 }} /> Add floor</MenuItem>
              <MenuItem onClick={() => open({ kind: "unit" })}><StorefrontRounded fontSize="small" sx={{ mr: 1 }} /> Add service unit</MenuItem>
            </Menu>
          </>
        }
      />

      {summary && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Total beds" value={summary.totalBeds} color={ACCENT} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Available" value={summary.available} color={STATUS_COLOR.AVAILABLE} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Occupied" value={summary.occupied} color={STATUS_COLOR.OCCUPIED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Reserved" value={summary.reserved} color={STATUS_COLOR.RESERVED} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Maintenance" value={summary.maintenance} color={STATUS_COLOR.MAINTENANCE} /></Grid>
        </Grid>
      )}

      {/* Licensed capacity, the way the workbook's sample hospital sums it: an
          ER trolley or a daycare recliner is a bed-space, not a census bed, and
          occupancy is of the census beds only. */}
      {census && (
        <Paper elevation={0} sx={{ px: 2.5, py: 1.5, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexWrap: "wrap", columnGap: 3, rowGap: 0.5, alignItems: "baseline" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Licensed capacity</Typography>
          {[
            ["census beds", census.censusBeds],
            ["critical care", census.criticalCareBeds],
            ["premium wing", census.premiumBeds],
            ["general", census.generalBeds],
            ["non-census bed-spaces", census.nonCensusBeds],
          ].map(([label, n]) => (
            <Typography key={label as string} variant="body2" sx={{ color: "text.secondary" }}>
              <Box component="span" sx={{ fontWeight: 800, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>{n}</Box> {label}
            </Typography>
          ))}
        </Paper>
      )}

      {/* Beds with no room class bill at BASE price. The bed's class is the
          default the discharge screen starts from, so an unclassed bed quietly
          charges a Private patient the General rate unless someone remembers to
          pick a class during discharge. Counted here because it is invisible
          otherwise — the bed cards looked normal. */}
      {unclassedBeds > 0 && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>{unclassedBeds}</strong> of {summary?.totalBeds ?? "?"} beds have no room class, so
          Schedule-of-Charges items bill at base price for them. Set one on each bed, or pick a class
          at discharge every time.
        </Alert>
      )}

      {isLoading ? <ListSkeleton />
        : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        : wards.length === 0 ? <Mascot pose="all-caught-up" title="No wards yet" subtitle="Use Add to create a ward, room, and beds." />
        : (
          <Stack spacing={2.5}>
            {wards.map((w) => (
              <Paper key={w.wardId} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                  <ApartmentRounded sx={{ color: ACCENT }} fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{w.wardName}</Typography>
                  {w.wardCode && <Chip label={w.wardCode} size="small" sx={{ fontFamily: "monospace", fontWeight: 700, height: 22 }} />}
                  <Chip label={w.wardTypeName ?? w.wardType} size="small" sx={{ bgcolor: "action.hover", fontWeight: 600, height: 22 }} />
                  {w.isCriticalCare && <Chip label="Critical care" size="small" sx={{ height: 22, fontWeight: 600, bgcolor: `${SEMANTIC.danger}14`, color: SEMANTIC.danger }} />}
                  {w.countsInCensus === false && (
                    <Tooltip title="Beds here are bed-spaces, not licensed capacity — they do not count toward occupancy.">
                      <Chip label="Not in census" size="small" sx={{ height: 22, fontWeight: 600 }} />
                    </Tooltip>
                  )}
                  {w.genderRestriction && w.genderRestriction !== "MIXED" && <Chip label={GENDER_LABEL[w.genderRestriction]} size="small" sx={{ height: 22, fontWeight: 600 }} />}
                  <Tooltip title="Edit ward">
                    <IconButton size="small" sx={{ ml: "auto", color: "text.secondary" }} onClick={() => setDialog({ kind: "ward", edit: w })}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5, pl: 3.5 }}>
                  {[w.floorLabel ?? `Floor ${w.floorNumber}`, w.departmentName, w.billingMode && w.billingMode !== "PER_DAY" ? `billed ${w.billingMode.replace("PER_", "per ").toLowerCase()}` : null].filter(Boolean).join(" · ")}
                </Typography>
                {w.rooms.length === 0 ? <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>No rooms</Typography> : w.rooms.map((r: RoomNode) => (
                  <Box key={r.roomId} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                        Room {r.roomNumber} · {r.roomTypeName ?? r.roomType}
                        {r.capacity ? ` · built for ${r.capacity}` : ""}
                      </Typography>
                      {r.amenities && r.amenities.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>· {r.amenities.join(", ")}</Typography>
                      )}
                      <Tooltip title="Edit room">
                        <IconButton size="small" sx={{ p: 0.25, color: "text.secondary" }} onClick={() => setDialog({ kind: "room", edit: { ...r, wardId: w.wardId } })}>
                          <EditRounded sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                      {r.beds.length === 0 ? <Typography variant="caption" sx={{ color: "text.disabled" }}>No beds</Typography> : r.beds.map((b: BedNode) => {
                        const notForPatients = b.isPatientBed === false;
                        const off = b.isActive === false;
                        const color = notForPatients || off ? NEUTRAL.muted : STATUS_COLOR[b.status] || NEUTRAL.muted;
                        return (
                          <Tooltip key={b.bedId} title={b.occupant ? `${b.occupant.patientName} (${b.occupant.uhid}) — edit details` : `${off ? "Decommissioned" : notForPatients ? "Not for patients" : b.status} — click to edit details`}>
                            <Box onClick={() => setDialog({ kind: "bed", edit: { ...b, roomId: r.roomId, wardId: w.wardId } })}
                              sx={{ cursor: "pointer", width: 140, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: `${color}55`, bgcolor: `${color}12`, position: "relative", opacity: off ? 0.55 : 1, "&:hover": { borderColor: color } }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>Bed {b.bedNumber}</Typography>
                                <EditRounded sx={{ fontSize: 13, color: "text.disabled" }} />
                              </Box>
                              {b.bedCode && <Typography variant="caption" sx={{ display: "block", fontFamily: "monospace", color: "text.secondary", fontSize: "0.68rem" }}>{b.bedCode}</Typography>}
                              {/* An absent room class used to show as nothing at all, so a bed
                                  that bills at base price looked identical to one priced by
                                  class. It is the default the discharge screen starts from, so
                                  silence here is the expensive kind. */}
                              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
                                {b.bedTypeName ?? b.bedType}
                                {notForPatients ? null : b.roomClassName
                                  ? ` · ${b.roomClassName}`
                                  : <Box component="span" sx={{ color: SEMANTIC.warning, fontWeight: 600 }}> · no class</Box>}
                              </Typography>
                              {b.isTemporary && <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 700, display: "block" }}>Temporary</Typography>}
                              {b.occupant ? (
                                <Typography variant="caption" sx={{ color, fontWeight: 600, display: "flex", alignItems: "center", gap: 0.3 }} noWrap><PersonRounded sx={{ fontSize: 12 }} /> {b.occupant.patientName}</Typography>
                              ) : (
                                <Typography variant="caption" sx={{ color, fontWeight: 700, textTransform: "capitalize" }}>{off ? "decommissioned" : notForPatients ? "not for patients" : b.status.toLowerCase()}</Typography>
                              )}
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Paper>
            ))}
          </Stack>
        )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <BuildingsPanel options={options} onEditBuilding={(b) => setDialog({ kind: "building", edit: b })} onEditFloor={(f) => setDialog({ kind: "floor", edit: f })} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ServiceUnitsPanel units={units} onEdit={(u) => setDialog({ kind: "unit", edit: u })} />
        </Grid>
      </Grid>

      {dialog && (dialog.kind === "ward" || dialog.kind === "room" || dialog.kind === "bed") && (
        <SetupDialog kind={dialog.kind} edit={dialog.edit} wards={wards} roomClasses={roomClasses} options={options} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === "bulk" && <BulkBedsDialog wards={wards} roomClasses={roomClasses} options={options} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "building" && <BuildingDialog edit={dialog.edit} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "floor" && <FloorDialog edit={dialog.edit} options={options} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "unit" && <ServiceUnitDialog edit={dialog.edit} options={options} onClose={() => setDialog(null)} onDone={done} />}
      {rentOpen && <RoomRentDialog onClose={() => setRentOpen(false)} onDone={() => { setRentOpen(false); refetch(); }} />}
    </Box>
  );
}

// ── Buildings & floors (optional) ────────────────────────────────────────────

function BuildingsPanel({ options, onEditBuilding, onEditFloor }: { options?: FacilityOptions; onEditBuilding: (b: Building) => void; onEditFloor: (f: Floor) => void }) {
  const buildings = options?.buildings ?? [];
  const floors = options?.floors ?? [];
  const loose = floors.filter((f) => !f.buildingId);
  const floorRow = (f: Floor) => (
    <Box key={f.floorId} sx={{ display: "flex", alignItems: "center", gap: 1, pl: 2, py: 0.25, opacity: f.isActive ? 1 : 0.5 }}>
      <LayersRounded sx={{ fontSize: 14, color: "text.disabled" }} />
      <Typography variant="body2" sx={{ flex: 1 }}>{f.name}</Typography>
      <IconButton size="small" onClick={() => onEditFloor(f)} sx={{ color: "text.secondary" }}><EditRounded sx={{ fontSize: 14 }} /></IconButton>
    </Box>
  );
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Buildings & floors</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
        Optional. A single-building hospital can skip this and give each ward a floor number.
      </Typography>
      {buildings.length === 0 && floors.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.disabled" }}>None set up — wards use a plain floor number.</Typography>
      ) : (
        <Stack spacing={1}>
          {buildings.map((b) => (
            <Box key={b.buildingId}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: b.isActive ? 1 : 0.5 }}>
                <DomainRounded sx={{ fontSize: 16, color: ACCENT }} />
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{b.name} <Box component="span" sx={{ color: "text.disabled", fontFamily: "monospace", fontWeight: 500 }}>{b.code}</Box></Typography>
                <IconButton size="small" onClick={() => onEditBuilding(b)} sx={{ color: "text.secondary" }}><EditRounded sx={{ fontSize: 14 }} /></IconButton>
              </Box>
              {floors.filter((f) => f.buildingId === b.buildingId).map(floorRow)}
            </Box>
          ))}
          {loose.length > 0 && (
            <Box>
              {buildings.length > 0 && <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Not in a building</Typography>}
              {loose.map(floorRow)}
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// ── Service units ────────────────────────────────────────────────────────────

function ServiceUnitsPanel({ units, onEdit }: { units: ServiceUnit[]; onEdit: (u: ServiceUnit) => void }) {
  const kinds = [...new Set(units.map((u) => u.postingType))];
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Service units</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
        Places staff are posted that are not wards — imaging suites, the lab, pharmacies, OPDs, billing counters, CSSD, the kitchen.
      </Typography>
      {units.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.disabled" }}>None yet. Use Add → Add service unit.</Typography>
      ) : (
        <Stack spacing={1.25}>
          {kinds.map((k) => (
            <Box key={k}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>{UNIT_KIND_LABEL[k] ?? k}</Typography>
              {units.filter((u) => u.postingType === k).map((u) => (
                <Box key={u.serviceUnitId} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25, opacity: u.isActive ? 1 : 0.5 }}>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {u.name} <Box component="span" sx={{ color: "text.disabled", fontFamily: "monospace" }}>{u.code}</Box>
                    {u.department?.departmentName ? <Box component="span" sx={{ color: "text.secondary" }}> · {u.department.departmentName}</Box> : null}
                  </Typography>
                  <IconButton size="small" onClick={() => onEdit(u)} sx={{ color: "text.secondary" }}><EditRounded sx={{ fontSize: 14 }} /></IconButton>
                </Box>
              ))}
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

// The tiers most hospitals start from — offered as one-click adds so first-time
// setup doesn't begin with a blank box and a trip to another screen.
const COMMON_TIERS = ["General", "Semi-Private", "Private", "Deluxe", "ICU"];

// Simple room-rent editor: a daily rate per room class, in one place. Saving
// writes the SOC "Room rent" item + its per-class prices AND applies them to every
// bed — so nobody has to build a charge item or matrix by hand.
//
// Tiers can also be CREATED here. Keeping this dialog "purely about rent" meant
// that with no tiers it was a dead end (Save disabled, pointing you to Schedule
// of Charges), so the common job — "Private rooms are ₹3000/day" — cost eight
// steps across two screens. Schedule of Charges → Room classes is still the full
// manager (rename, reorder, deactivate, delete); this just removes the detour
// for the one action people actually start with.
function RoomRentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rents, setRents] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newRent, setNewRent] = useState("");
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch } = useQuery<RoomClassRentsResponse>({
    queryKey: ["room-class-rents"],
    queryFn: async () => (await axiosInstance.get("/ipd/room-class-rents")).data.data,
  });
  const classes: RoomClassRent[] = data?.rents || [];
  const missingTiers = COMMON_TIERS.filter(
    (t) => !classes.some((c) => String(c.name).toLowerCase() === t.toLowerCase()),
  );

  useEffect(() => {
    if (!data) return;
    // Merge rather than replace: adding a tier refetches, and a wholesale reset
    // would wipe rents the user has already typed but not yet saved.
    setRents((prev) => {
      const m: Record<string, string> = {};
      for (const c of data.rents || []) {
        m[c.roomClassId] = prev[c.roomClassId] !== undefined
          ? prev[c.roomClassId]
          : (c.rent != null ? String(c.rent) : "");
      }
      return m;
    });
  }, [data]);

  // Create a tier, then park the typed rent against it so the row lands ready
  // to save. The tier itself is a structural record so it's written immediately;
  // rents still commit together under "Save rents".
  const addTier = async (name: string, rent?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (classes.some((c) => String(c.name).toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    setAdding(true);
    try {
      const created = (await axiosInstance.post("/hospital/soc/room-classes", { name: trimmed })).data?.data;
      await refetch();
      if (created?.roomClassId && rent?.trim()) {
        setRents((m) => ({ ...m, [created.roomClassId]: rent.trim() }));
      }
      setNewName("");
      setNewRent("");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't add that tier"));
    } finally {
      setAdding(false);
    }
  };

  const save = async () => {
    const payload = classes
      .map((c) => ({ roomClassId: c.roomClassId, rent: Number(rents[c.roomClassId]) }))
      .filter((r) => Number.isFinite(r.rent) && r.rent >= 0);
    if (!payload.length) { toast.error("Enter a rent for at least one class"); return; }
    setSaving(true);
    try {
      await axiosInstance.put("/ipd/room-class-rents", { rents: payload });
      await axiosInstance.post("/ipd/beds/resync-rents");
      toast.success("Room rents saved and applied to beds");
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't save rents"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentsRounded sx={{ color: ACCENT }} /> Room rent — daily charge per class
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : (
          <>
            {classes.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary", pb: 0.5 }}>
                Room classes are your pricing tiers. Add one below with its daily rate — that's the whole setup.
              </Typography>
            ) : (
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                {classes.map((c) => (
                  <Box key={c.roomClassId} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{c.name}</Typography>
                    <TextField size="small" type="number" value={rents[c.roomClassId] ?? ""} onChange={(e) => setRents({ ...rents, [c.roomClassId]: e.target.value })}
                      sx={{ width: 140 }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment>, endAdornment: <InputAdornment position="end">/day</InputAdornment> }} />
                  </Box>
                ))}
              </Stack>
            )}

            {/* Add a tier without leaving the dialog. */}
            <Box sx={{ mt: classes.length ? 2.5 : 1.5, pt: classes.length ? 2 : 0, borderTop: classes.length ? "1px solid" : "none", borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  size="small" placeholder="Add a tier (e.g. Deluxe)" value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTier(newName, newRent); } }}
                  sx={{ flex: 1, minWidth: 0 }} disabled={adding}
                />
                <TextField
                  size="small" type="number" placeholder="Rate" value={newRent}
                  onChange={(e) => setNewRent(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTier(newName, newRent); } }}
                  sx={{ width: 140 }} disabled={adding}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment>, endAdornment: <InputAdornment position="end">/day</InputAdornment> }}
                />
                <Button onClick={() => addTier(newName, newRent)} disabled={adding || !newName.trim()} sx={{ flexShrink: 0 }}>
                  Add
                </Button>
              </Box>

              {missingTiers.length > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mt: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Quick add:</Typography>
                  {missingTiers.map((t) => (
                    <Chip key={t} label={t} size="small" variant="outlined" onClick={() => addTier(t)} disabled={adding} sx={{ cursor: "pointer" }} />
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 1.25, mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
              <InfoOutlined sx={{ fontSize: 18, color: "text.secondary", mt: 0.15, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Saving sets every bed's daily charge to match its room class.
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                  To rename, reorder or remove a tier, use{" "}
                  <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Schedule of Charges → Room classes</Box>.
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || classes.length === 0}>
          {saving ? "Saving…" : "Save rents"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Choices for the type pickers, active types only (plus the current one when editing). */
function typeOptions<T extends { id: string; displayName: string; isActive: boolean }>(list: T[] | undefined, current: string, secondary: (t: T) => string) {
  return (list ?? []).filter((t) => t.isActive || t.id === current).map((t) => ({ value: t.id, label: t.displayName, secondary: secondary(t) }));
}

function SetupDialog({ kind, edit, wards, roomClasses, options, onClose, onDone }: { kind: FacilityKind; edit?: FacilityEditTarget; wards: WardNode[]; roomClasses: RoomClass[]; options?: FacilityOptions; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const isEdit = Boolean(edit?.wardId || edit?.roomId || edit?.bedId);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<SetupForm>(() => ({
    wardId: edit?.wardId, roomId: edit?.roomId, bedId: edit?.bedId,
    wardName: edit?.wardName, roomNumber: edit?.roomNumber, bedNumber: edit?.bedNumber,
    floorNumber: edit?.floorNumber != null ? String(edit.floorNumber) : "1",
    dailyCharge: edit?.dailyCharge != null ? String(edit.dailyCharge) : "",
    roomClassId: edit?.roomClassId ?? "",
    wardCode: edit?.wardCode ?? "",
    hospitalWardTypeId: edit?.hospitalWardTypeId ?? "",
    departmentId: edit?.departmentId ?? "",
    genderRestriction: edit?.genderRestriction ?? "MIXED",
    floorId: edit?.floorId ?? "",
    hospitalRoomTypeId: edit?.hospitalRoomTypeId ?? "",
    capacity: edit?.capacity != null ? String(edit.capacity) : "",
    amenities: (edit?.amenities ?? []).join(", "),
    hospitalBedTypeId: edit?.hospitalBedTypeId ?? "",
    bedCode: edit?.bedCode ?? "",
    isTemporary: edit?.isTemporary ?? false,
    isActive: edit?.isActive ?? true,
  }));
  const set = <K extends keyof SetupForm>(k: K, v: SetupForm[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // SOC-driven daily rent per room class — used to auto-fill the bed's daily charge.
  const { data: rentInfo } = useQuery<RoomClassRentsResponse>({
    queryKey: ["room-class-rents"],
    queryFn: async () => (await axiosInstance.get("/ipd/room-class-rents")).data.data,
    enabled: kind === "bed",
  });
  const rentFor = (rcId: string): number | null => {
    if (!rentInfo?.configured) return null;
    const row = (rentInfo.rents || []).find((r) => r.roomClassId === rcId);
    return row && row.rent != null ? Number(row.rent) : (rentInfo.baseRent ?? null);
  };
  // Picking a room class fills the daily rent from SOC (still editable afterwards).
  const pickClass = (rcId: string) => {
    set("roomClassId", rcId);
    const r = rentFor(rcId);
    if (r != null) set("dailyCharge", String(r));
  };

  const ward = wards.find((w) => w.wardId === f.wardId);
  const rooms = ward?.rooms || [];
  const room = rooms.find((r) => r.roomId === f.roomId);
  const editingWard = kind === "ward" && isEdit;
  const editingRoom = kind === "room" && isEdit;
  const editingBed = kind === "bed" && isEdit;

  const wardType = options?.wardTypes.find((t) => t.id === f.hospitalWardTypeId);
  const genders = gendersFor(wardType?.genderRestriction);
  // A type change can rule out the ward's gender: fall back to the new type's default.
  const pickWardType = (id: string) => {
    const allowed = gendersFor(options?.wardTypes.find((t) => t.id === id)?.genderRestriction);
    setF((prev) => ({ ...prev, hospitalWardTypeId: id, genderRestriction: allowed.includes(prev.genderRestriction) ? prev.genderRestriction : allowed[0] }));
  };

  const floors = options?.floors ?? [];
  const bedType = options?.bedTypes.find((t) => t.id === f.hospitalBedTypeId);

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "ward") {
        const body = {
          wardName: f.wardName, wardCode: f.wardCode.trim() || undefined, hospitalWardTypeId: f.hospitalWardTypeId,
          departmentId: f.departmentId || null, genderRestriction: f.genderRestriction,
          ...(f.floorId ? { floorId: f.floorId } : { floorId: null, floorNumber: Number(f.floorNumber) }),
        };
        if (editingWard) await axiosInstance.put(`/ipd/wards/${f.wardId}`, { ...body, wardCode: f.wardCode.trim() || edit?.wardCode });
        else await axiosInstance.post("/ipd/wards", body);
      } else if (kind === "room") {
        const body = { roomNumber: f.roomNumber, hospitalRoomTypeId: f.hospitalRoomTypeId, capacity: f.capacity ? Number(f.capacity) : null, amenities: f.amenities };
        if (editingRoom) await axiosInstance.put(`/ipd/rooms/${f.roomId}`, body);
        else await axiosInstance.post("/ipd/rooms", { wardId: f.wardId, ...body });
      } else {
        const charge = f.dailyCharge === "" ? null : Number(f.dailyCharge);
        const common = { bedNumber: f.bedNumber, hospitalBedTypeId: f.hospitalBedTypeId, isTemporary: f.isTemporary };
        // Empty room-class clears the link; the backend treats "" / null as no class.
        if (editingBed) {
          await axiosInstance.put(`/ipd/beds/${f.bedId}`, {
            ...common, dailyCharge: charge, roomClassId: f.roomClassId || null, isActive: f.isActive,
            ...(f.bedCode.trim() && f.bedCode.trim() !== edit?.bedCode ? { bedCode: f.bedCode.trim() } : {}),
          });
        } else {
          await axiosInstance.post("/ipd/beds", { roomId: f.roomId, ...common, bedCode: f.bedCode.trim() || undefined, dailyCharge: f.dailyCharge ? Number(f.dailyCharge) : undefined, roomClassId: f.roomClassId || undefined });
        }
      }
      toast.success(`${kind[0].toUpperCase() + kind.slice(1)} ${isEdit ? "updated" : "added"}`);
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const valid = kind === "ward" ? f.wardName && f.hospitalWardTypeId && (f.floorId || f.floorNumber !== "")
    : kind === "room" ? f.wardId && f.roomNumber && f.hospitalRoomTypeId
      : f.roomId && f.bedNumber && f.hospitalBedTypeId;
  const onSelect = (k: keyof SetupForm) => (e: { target: { value: unknown } }) => set(k, String(e.target.value ?? "") as never);

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit" : "Add"} {kind}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {kind === "ward" && (<>
            <TextField fullWidth required label="Ward name" value={f.wardName || ""} onChange={(e) => set("wardName", e.target.value)} />
            <TextField fullWidth label="Ward code" value={f.wardCode} onChange={(e) => set("wardCode", e.target.value.toUpperCase())}
              helperText={editingWard ? "Used in bed codes. Changing it does not rename existing beds." : "Short code used in bed codes (MICU-305-01). Leave blank to make one from the name."}
              slotProps={{ htmlInput: { maxLength: 20 } }} />
            <SearchableSelect label="Ward type" name="hospitalWardTypeId" required value={f.hospitalWardTypeId} onChange={(e) => pickWardType(String(e.target.value ?? ""))}
              placeholder="Pick a ward type" searchPlaceholder="Search ward types…"
              options={typeOptions(options?.wardTypes, f.hospitalWardTypeId, (t) => [t.isCriticalCare && "Critical care", t.countsInCensus ? "in census" : "not in census", t.defaultBillingMode.replace("PER_", "per ").toLowerCase()].filter(Boolean).join(" · "))} />
            <SearchableSelect label="Owning department" name="departmentId" value={f.departmentId} onChange={onSelect("departmentId")}
              emptyOption={{ value: "", label: "None" }} searchPlaceholder="Search departments…"
              options={(options?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.departmentName }))}
              helperText="Departments you have switched on. The one whose patients this ward mainly holds." />
            <TextField select fullWidth label="Patients" value={f.genderRestriction} disabled={genders.length === 1} onChange={(e) => set("genderRestriction", e.target.value)}
              helperText={genders.length === 1 ? (genders[0] === "FEMALE" ? "This ward type is female-only." : "This ward type is always mixed.") : "Male-only or female-only wards stop the wrong patient being admitted here."}>
              {genders.map((g) => <MenuItem key={g} value={g}>{GENDER_LABEL[g]}</MenuItem>)}
            </TextField>
            {floors.length > 0 ? (
              <TextField select fullWidth label="Floor" value={f.floorId} onChange={(e) => set("floorId", e.target.value)}>
                <MenuItem value=""><em>No floor set up — use a number</em></MenuItem>
                {floors.filter((x) => x.isActive || x.floorId === f.floorId).map((x) => <MenuItem key={x.floorId} value={x.floorId}>{[x.building?.name, x.name].filter(Boolean).join(" · ")}</MenuItem>)}
              </TextField>
            ) : null}
            {!f.floorId && (
              <TextField fullWidth required type="number" label="Floor number" value={f.floorNumber} onChange={(e) => set("floorNumber", e.target.value)} helperText="0 = ground, -1 = basement." />
            )}
          </>)}
          {kind === "room" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} disabled={editingRoom} onChange={(e) => set("wardId", e.target.value)}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Room number" value={f.roomNumber || ""} onChange={(e) => set("roomNumber", e.target.value)} />
            <SearchableSelect label="Room type" name="hospitalRoomTypeId" required value={f.hospitalRoomTypeId}
              onChange={(e) => {
                const id = String(e.target.value ?? "");
                set("hospitalRoomTypeId", id);
                // A room type's typical capacity pre-fills the field when it is one number.
                const t = options?.roomTypes.find((x) => x.id === id);
                if (t && /^\d+$/.test(t.typicalCapacity) && !f.capacity) set("capacity", t.typicalCapacity);
              }}
              placeholder="Pick a room type" searchPlaceholder="Search room types…"
              options={typeOptions(options?.roomTypes, f.hospitalRoomTypeId, (t) => [`${t.typicalCapacity} bed${t.typicalCapacity === "1" ? "" : "s"}`, t.isolationCapable && "isolation", t.pressureType !== "NONE" && `${t.pressureType.toLowerCase()} pressure`, t.isProcedureRoom && "procedure room"].filter(Boolean).join(" · "))} />
            <TextField fullWidth type="number" label="Capacity (beds)" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} />
            <TextField fullWidth label="Amenities" value={f.amenities} onChange={(e) => set("amenities", e.target.value)} helperText="Comma-separated — AC, TV, attendant sofa, oxygen point." />
          </>)}
          {kind === "bed" && (<>
            <TextField select fullWidth required label="Ward" value={f.wardId || ""} disabled={editingBed} onChange={(e) => { set("wardId", e.target.value); set("roomId", ""); }}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
            <TextField select fullWidth required label="Room" value={f.roomId || ""} disabled={editingBed || !f.wardId} onChange={(e) => set("roomId", e.target.value)} helperText={!editingBed && f.wardId && rooms.length === 0 ? "Add a room to this ward first" : undefined}>{rooms.map((r) => <MenuItem key={r.roomId} value={r.roomId}>Room {r.roomNumber}</MenuItem>)}</TextField>
            <TextField fullWidth required label="Bed number" value={f.bedNumber || ""} onChange={(e) => set("bedNumber", e.target.value)} />
            <SearchableSelect label="Bed type" name="hospitalBedTypeId" required value={f.hospitalBedTypeId} onChange={onSelect("hospitalBedTypeId")}
              placeholder="Pick a bed type" searchPlaceholder="Search bed types…"
              options={typeOptions(options?.bedTypes, f.hospitalBedTypeId, (t) => (!t.isPatientBed ? "not for patients — never allocated" : t.countsAsLicensedBed ? "licensed bed" : "not a licensed bed"))}
              helperText={bedType && !bedType.isPatientBed ? "Attendant beds are never allocated to a patient or counted in occupancy." : undefined} />
            <TextField fullWidth label="Bed code" value={f.bedCode} onChange={(e) => set("bedCode", e.target.value.toUpperCase())}
              helperText={f.bedCode ? "Must be unique in this branch." : `Leave blank for ${previewBedCode(ward?.wardCode, room?.roomNumber, f.bedNumber)}`}
              slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField select fullWidth label="Room class (pricing)" value={f.roomClassId || ""} onChange={(e) => pickClass(e.target.value)}
              helperText="Sets the price tier for this bed's charges — and fills the daily rent from the Schedule of Charges.">
              <MenuItem value=""><em>None (base price)</em></MenuItem>
              {/* Active classes, plus the bed's current class even if later deactivated. */}
              {roomClasses.filter((rc) => rc.isActive || rc.roomClassId === f.roomClassId).map((rc) => <MenuItem key={rc.roomClassId} value={rc.roomClassId}>{rc.name}{rc.isActive ? "" : " (inactive)"}</MenuItem>)}
            </TextField>
            <TextField fullWidth type="number" label="Daily charge (₹)" value={f.dailyCharge || ""} onChange={(e) => set("dailyCharge", e.target.value)}
              helperText={rentInfo?.configured
                ? (rentFor(f.roomClassId) != null ? `Auto-filled from Schedule of Charges (₹${rentFor(f.roomClassId)}) — editable` : "Editable")
                : "Tip: add a 'Room rent' charge (type Bed) in the Schedule of Charges to auto-fill this."}
              InputProps={rentInfo?.configured && rentFor(f.roomClassId) != null ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Reset to the SOC price for this room class">
                      <Button size="small" onClick={() => set("dailyCharge", String(rentFor(f.roomClassId)))} sx={{ textTransform: "none", minWidth: 0, px: 1 }}>SOC</Button>
                    </Tooltip>
                  </InputAdornment>
                ),
              } : undefined} />
            <Box>
              <FormControlLabel control={<Switch checked={f.isTemporary} onChange={(e) => set("isTemporary", e.target.checked)} />} label="Temporary (surge) bed" />
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 6, mt: -0.5 }}>Can take a patient, but is not part of licensed capacity.</Typography>
            </Box>
            {editingBed && (
              <Box>
                <FormControlLabel control={<Switch checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />} label="In use" />
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 6, mt: -0.5 }}>Switch off to decommission — the bed stays in history but is never offered or counted.</Typography>
              </Box>
            )}
          </>)}
          <Divider />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !valid}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Several beds at once ─────────────────────────────────────────────────────

function BulkBedsDialog({ wards, roomClasses, options, onClose, onDone }: { wards: WardNode[]; roomClasses: RoomClass[]; options?: FacilityOptions; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [wardId, setWardId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [count, setCount] = useState("6");
  const [start, setStart] = useState("1");
  const [prefix, setPrefix] = useState("");
  const [typeId, setTypeId] = useState("");
  const [roomClassId, setRoomClassId] = useState("");
  const ward = wards.find((w) => w.wardId === wardId);
  const room = ward?.rooms.find((r) => r.roomId === roomId);
  const n = Math.max(0, Math.min(100, Number(count) || 0));
  const first = Number(start) || 0;
  const preview = useMemo(() => {
    if (!room || !n) return "";
    const a = previewBedCode(ward?.wardCode, room.roomNumber, `${prefix}${first}`);
    const b = previewBedCode(ward?.wardCode, room.roomNumber, `${prefix}${first + n - 1}`);
    return n === 1 ? a : `${a} … ${b}`;
  }, [room, ward, n, first, prefix]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await axiosInstance.post("/ipd/beds/bulk", { roomId, count: n, startNumber: first, prefix: prefix || undefined, hospitalBedTypeId: typeId, roomClassId: roomClassId || undefined });
      toast.success(`${r.data.data.created} beds added to room ${room?.roomNumber}`);
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't add the beds"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add several beds</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField select fullWidth required label="Ward" value={wardId} onChange={(e) => { setWardId(e.target.value); setRoomId(""); }}>{wards.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}</TextField>
          <TextField select fullWidth required label="Room" value={roomId} disabled={!wardId} onChange={(e) => setRoomId(e.target.value)}>{(ward?.rooms ?? []).map((r) => <MenuItem key={r.roomId} value={r.roomId}>Room {r.roomNumber}</MenuItem>)}</TextField>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField required type="number" label="Beds" value={count} onChange={(e) => setCount(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 100 } }} />
            <TextField type="number" label="First number" value={start} onChange={(e) => setStart(e.target.value)} />
            <TextField label="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} slotProps={{ htmlInput: { maxLength: 10 } }} />
          </Box>
          <SearchableSelect label="Bed type" name="bedType" required value={typeId} onChange={(e) => setTypeId(String(e.target.value ?? ""))}
            placeholder="Pick a bed type" searchPlaceholder="Search bed types…"
            options={typeOptions(options?.bedTypes, typeId, (t) => (!t.isPatientBed ? "not for patients" : t.countsAsLicensedBed ? "licensed bed" : "not a licensed bed"))} />
          <TextField select fullWidth label="Room class (pricing)" value={roomClassId} onChange={(e) => setRoomClassId(e.target.value)}>
            <MenuItem value=""><em>None (base price)</em></MenuItem>
            {roomClasses.filter((rc) => rc.isActive).map((rc) => <MenuItem key={rc.roomClassId} value={rc.roomClassId}>{rc.name}</MenuItem>)}
          </TextField>
          {preview && <Alert severity="info" icon={<InfoOutlined fontSize="small" />}>Bed codes: <strong>{preview}</strong></Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !roomId || !typeId || !n}>{saving ? "Adding…" : `Add ${n || ""} beds`}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Building / floor / service unit ─────────────────────────────────────────

function SimpleDialog({ title, saving, valid, onClose, onSave, children }: { title: string; saving: boolean; valid: boolean; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers><Stack spacing={2.5} sx={{ pt: 0.5 }}>{children}</Stack></DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !valid}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Save through the API and toast; shared by the three small dialogs. */
function useSaver(onDone: () => void) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try { await fn(); toast.success(ok); onDone(); }
    catch (e) { toast.error(getApiErrorMessage(e, "Failed to save")); }
    finally { setSaving(false); }
  };
  return { saving, run };
}

function BuildingDialog({ edit, onClose, onDone }: { edit?: Building; onClose: () => void; onDone: () => void }) {
  const { saving, run } = useSaver(onDone);
  const [code, setCode] = useState(edit?.code ?? "");
  const [name, setName] = useState(edit?.name ?? "");
  const [active, setActive] = useState(edit?.isActive ?? true);
  const save = () => run(() => edit
    ? axiosInstance.put(`/ipd/buildings/${edit.buildingId}`, { code, name, isActive: active })
    : axiosInstance.post("/ipd/buildings", { code, name }), edit ? "Building updated" : "Building added");
  return (
    <SimpleDialog title={edit ? "Edit building" : "Add building"} saving={saving} valid={!!code.trim() && !!name.trim()} onClose={onClose} onSave={save}>
      <TextField fullWidth required label="Building name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Tower" />
      <TextField fullWidth required label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MT" slotProps={{ htmlInput: { maxLength: 20 } }} />
      {edit && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="In use" />}
    </SimpleDialog>
  );
}

function FloorDialog({ edit, options, onClose, onDone }: { edit?: Floor; options?: FacilityOptions; onClose: () => void; onDone: () => void }) {
  const { saving, run } = useSaver(onDone);
  const [buildingId, setBuildingId] = useState(edit?.buildingId ?? "");
  const [floorNumber, setFloorNumber] = useState(edit ? String(edit.floorNumber) : "");
  const [name, setName] = useState(edit?.name ?? "");
  const [active, setActive] = useState(edit?.isActive ?? true);
  const save = () => run(() => edit
    ? axiosInstance.put(`/ipd/floors/${edit.floorId}`, { buildingId: buildingId || null, floorNumber: Number(floorNumber), name, isActive: active })
    : axiosInstance.post("/ipd/floors", { buildingId: buildingId || undefined, floorNumber: Number(floorNumber), name: name || undefined }), edit ? "Floor updated" : "Floor added");
  const buildings = options?.buildings ?? [];
  return (
    <SimpleDialog title={edit ? "Edit floor" : "Add floor"} saving={saving} valid={floorNumber !== "" && Number.isInteger(Number(floorNumber)) && (!edit || !!name.trim())} onClose={onClose} onSave={save}>
      {buildings.length > 0 && (
        <TextField select fullWidth label="Building" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
          <MenuItem value=""><em>Not in a building</em></MenuItem>
          {buildings.map((b) => <MenuItem key={b.buildingId} value={b.buildingId}>{b.name}</MenuItem>)}
        </TextField>
      )}
      <TextField fullWidth required type="number" label="Floor number" value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} helperText="0 = ground, -1 = basement 1." />
      <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={floorNumber === "0" ? "Ground floor" : floorNumber ? `Floor ${floorNumber}` : "Floor 3 — Critical care"} helperText={edit ? undefined : "Leave blank for “Floor 3”, “Ground floor”…"} />
      {edit && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="In use" />}
    </SimpleDialog>
  );
}

function ServiceUnitDialog({ edit, options, onClose, onDone }: { edit?: ServiceUnit; options?: FacilityOptions; onClose: () => void; onDone: () => void }) {
  const { saving, run } = useSaver(onDone);
  const [name, setName] = useState(edit?.name ?? "");
  const [code, setCode] = useState(edit?.code ?? "");
  const [postingType, setPostingType] = useState(edit?.postingType ?? "");
  const [departmentId, setDepartmentId] = useState(edit?.departmentId ?? "");
  const [floorId, setFloorId] = useState(edit?.floorId ?? "");
  const [active, setActive] = useState(edit?.isActive ?? true);
  const body = { name, code, postingType, departmentId: departmentId || null, floorId: floorId || null };
  const save = () => run(() => edit
    ? axiosInstance.put(`/ipd/service-units/${edit.serviceUnitId}`, { ...body, isActive: active })
    : axiosInstance.post("/ipd/service-units", body), edit ? "Service unit updated" : "Service unit added");
  const kinds = options?.postingTypes?.length ? options.postingTypes : Object.keys(UNIT_KIND_LABEL).map((c) => ({ code: c, meaning: UNIT_KIND_LABEL[c] }));
  return (
    <SimpleDialog title={edit ? "Edit service unit" : "Add service unit"} saving={saving} valid={!!name.trim() && !!code.trim() && !!postingType} onClose={onClose} onSave={save}>
      <TextField fullWidth required label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Radiology — CT / MRI Suite" />
      <TextField fullWidth required label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CTMRI" slotProps={{ htmlInput: { maxLength: 20 } }} />
      <TextField select fullWidth required label="Kind" value={postingType} onChange={(e) => setPostingType(e.target.value)}>
        {kinds.map((k) => <MenuItem key={k.code} value={k.code}>{UNIT_KIND_LABEL[k.code] ?? k.meaning}</MenuItem>)}
      </TextField>
      <SearchableSelect label="Department" name="departmentId" value={departmentId} onChange={(e) => setDepartmentId(String(e.target.value ?? ""))}
        emptyOption={{ value: "", label: "None" }} searchPlaceholder="Search departments…"
        options={(options?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.departmentName }))} />
      {(options?.floors ?? []).length > 0 && (
        <TextField select fullWidth label="Floor" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
          <MenuItem value=""><em>Not set</em></MenuItem>
          {(options?.floors ?? []).map((x) => <MenuItem key={x.floorId} value={x.floorId}>{[x.building?.name, x.name].filter(Boolean).join(" · ")}</MenuItem>)}
        </TextField>
      )}
      {edit && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="In use" />}
    </SimpleDialog>
  );
}

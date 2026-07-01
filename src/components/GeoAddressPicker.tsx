import { useEffect, useRef } from "react";
import { Grid, TextField, MenuItem, InputAdornment, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../api/axios";

interface GeoOption { stateId?: number; districtId?: number; name: string }

export interface GeoValue {
  stateId?: number | "" | null;      // id-based forms (Hospital: stateId)
  stateName?: string;                // name-based forms (Patient/User/Supplier: state)
  districtId?: number | "" | null;   // id-based forms (Hospital: cityId)
  districtName?: string;             // name-based forms: district
  city?: string;                     // free-text city / town
  pincode?: string;
}

interface Props {
  value: GeoValue;
  /** Patch carries ids AND names so both id- and name-based forms can read it. */
  onChange: (patch: GeoValue) => void;
  colSpan?: number;
  required?: boolean;
  showPincode?: boolean;
}

/**
 * Address helper: State → District cascading dropdowns (from /api/geo) + a
 * free-text City + Pincode that auto-fills state & district. Works for id-based
 * forms (Hospital: stateId/cityId) and name-based forms (state/district/city
 * strings) — the onChange patch always includes both ids and names.
 * Renders <Grid> items; use inside a <Grid container>.
 */
export default function GeoAddressPicker({ value, onChange, colSpan = 3, required, showPincode = true }: Props) {
  const { data: states = [] } = useQuery<GeoOption[]>({
    queryKey: ["geo-states"],
    queryFn: async () => (await axiosInstance.get("/geo/states")).data.data,
    staleTime: Infinity,
  });

  const stateId = value.stateId
    ? Number(value.stateId)
    : (value.stateName ? states.find((s) => s.name === value.stateName)?.stateId ?? "" : "");

  const { data: districts = [] } = useQuery<GeoOption[]>({
    queryKey: ["geo-districts", stateId],
    queryFn: async () => (await axiosInstance.get(`/geo/districts?stateId=${stateId}`)).data.data,
    enabled: !!stateId,
    staleTime: Infinity,
  });

  const districtId = value.districtId
    ? Number(value.districtId)
    : (value.districtName ? districts.find((d) => d.name === value.districtName)?.districtId ?? "" : "");

  const city = value.city ?? "";
  const pincode = value.pincode ?? "";

  // Pincode autofill: 6 digits → set State + District (city stays user-entered).
  const lastLookup = useRef<string>("");
  const lookingUp = useRef(false);
  useEffect(() => {
    const code = pincode.trim();
    if (!/^\d{6}$/.test(code) || code === lastLookup.current) return;
    lastLookup.current = code;
    lookingUp.current = true;
    axiosInstance
      .get(`/geo/pincode/${code}`)
      .then((r) => {
        const d = r.data?.data;
        if (d?.state?.stateId) onChange({
          stateId: d.state.stateId, stateName: d.state.name,
          districtId: d.district?.districtId ?? null, districtName: d.district?.name ?? "",
          pincode: code,
        });
      })
      .catch(() => { /* unknown pincode — leave as-is */ })
      .finally(() => { lookingUp.current = false; });
  }, [pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          select fullWidth label="State" required={required}
          value={stateId}
          onChange={(e) => {
            const id = Number(e.target.value);
            onChange({ stateId: id, stateName: states.find((s) => s.stateId === id)?.name ?? "", districtId: null, districtName: "" });
          }}
        >
          <MenuItem value=""><em>Select state</em></MenuItem>
          {states.map((s) => <MenuItem key={s.stateId} value={s.stateId}>{s.name}</MenuItem>)}
        </TextField>
      </Grid>

      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          select fullWidth label="District" required={required}
          value={districtId} disabled={!stateId}
          onChange={(e) => {
            const id = Number(e.target.value);
            onChange({ districtId: id, districtName: districts.find((d) => d.districtId === id)?.name ?? "" });
          }}
        >
          <MenuItem value=""><em>{stateId ? "Select district" : "Select a state first"}</em></MenuItem>
          {districts.map((d) => <MenuItem key={d.districtId} value={d.districtId}>{d.name}</MenuItem>)}
        </TextField>
      </Grid>

      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          fullWidth label="City / Town" required={required}
          value={city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="e.g. Hyderabad"
        />
      </Grid>

      {showPincode && (
        <Grid size={{ xs: 12, md: colSpan }}>
          <TextField
            fullWidth label="Pincode" required={required}
            value={pincode}
            inputProps={{ inputMode: "numeric", maxLength: 6 }}
            onChange={(e) => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            helperText="6 digits — auto-fills state & district"
            InputProps={{ endAdornment: lookingUp.current ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> : undefined }}
          />
        </Grid>
      )}
    </>
  );
}

import { useEffect, useRef } from "react";
import { Grid, TextField, MenuItem, InputAdornment, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../api/axios";

interface GeoOption { stateId?: number; districtId?: number; name: string }

export interface GeoValue {
  stateId?: number | "" | null;
  districtId?: number | "" | null; // parent may map this to cityId
  stateName?: string;
  districtName?: string;
  pincode?: string;
}

interface Props {
  value: GeoValue;
  /** Patch carries ids AND names — id-based forms read stateId/districtId,
   *  name-based forms read stateName/districtName. */
  onChange: (patch: GeoValue) => void;
  colSpan?: number;
  required?: boolean;
  /** Hide the pincode field (e.g. entities that don't store a postal code). */
  showPincode?: boolean;
}

/**
 * State → District cascading dropdowns + pincode autofill, backed by /api/geo.
 * Works for both id-storing forms (Hospital: stateId/cityId) and name-storing
 * forms (Patient/User/Supplier: state/city strings) — the onChange patch always
 * includes both ids and names. Renders <Grid> items; use inside a <Grid container>.
 */
export default function GeoAddressPicker({ value, onChange, colSpan = 4, required, showPincode = true }: Props) {
  const { data: states = [] } = useQuery<GeoOption[]>({
    queryKey: ["geo-states"],
    queryFn: async () => (await axiosInstance.get("/geo/states")).data.data,
    staleTime: Infinity,
  });

  // Resolve the active state: explicit id, else match a saved name once states load.
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

  const pincode = value.pincode ?? "";

  // Pincode autofill: 6 digits → resolve state + district.
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
          select fullWidth label="City / District" required={required}
          value={districtId} disabled={!stateId}
          onChange={(e) => {
            const id = Number(e.target.value);
            onChange({ districtId: id, districtName: districts.find((d) => d.districtId === id)?.name ?? "" });
          }}
        >
          <MenuItem value=""><em>{stateId ? "Select city / district" : "Select a state first"}</em></MenuItem>
          {districts.map((d) => <MenuItem key={d.districtId} value={d.districtId}>{d.name}</MenuItem>)}
        </TextField>
      </Grid>

      {showPincode && (
        <Grid size={{ xs: 12, md: colSpan }}>
          <TextField
            fullWidth label="Pincode" required={required}
            value={pincode}
            inputProps={{ inputMode: "numeric", maxLength: 6 }}
            onChange={(e) => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            helperText="Enter 6 digits to auto-fill state & district"
            InputProps={{ endAdornment: lookingUp.current ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> : undefined }}
          />
        </Grid>
      )}
    </>
  );
}

import { useEffect, useRef } from "react";
import { Grid, TextField, MenuItem, InputAdornment, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../api/axios";

interface GeoOption { stateId?: number; districtId?: number; name: string }

export interface GeoValue {
  stateId?: number | "" | null;
  districtId?: number | "" | null; // parent may map this to cityId
  pincode?: string;
}

interface Props {
  value: GeoValue;
  onChange: (patch: GeoValue) => void;
  /** Grid column span for each field (out of 12). */
  colSpan?: number;
  required?: boolean;
}

/**
 * State → District cascading dropdowns + pincode autofill, backed by /api/geo.
 * Renders three <Grid> items, so use it inside a <Grid container>.
 * `districtId` is generic — the parent decides which field it maps to (e.g. cityId).
 */
export default function GeoAddressPicker({ value, onChange, colSpan = 4, required }: Props) {
  const stateId = value.stateId ? Number(value.stateId) : "";
  const districtId = value.districtId ? Number(value.districtId) : "";
  const pincode = value.pincode ?? "";

  const { data: states = [] } = useQuery<GeoOption[]>({
    queryKey: ["geo-states"],
    queryFn: async () => (await axiosInstance.get("/geo/states")).data.data,
    staleTime: Infinity,
  });

  const { data: districts = [] } = useQuery<GeoOption[]>({
    queryKey: ["geo-districts", stateId],
    queryFn: async () => (await axiosInstance.get(`/geo/districts?stateId=${stateId}`)).data.data,
    enabled: !!stateId,
    staleTime: Infinity,
  });

  // Pincode autofill: when 6 digits are entered, resolve state + district.
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
        if (d?.state?.stateId) onChange({ stateId: d.state.stateId, districtId: d.district?.districtId ?? null, pincode: code });
      })
      .catch(() => { /* unknown pincode — leave dropdowns as-is */ })
      .finally(() => { lookingUp.current = false; });
  }, [pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          select fullWidth label="State" required={required}
          value={stateId}
          onChange={(e) => onChange({ stateId: Number(e.target.value), districtId: null })}
        >
          <MenuItem value=""><em>Select state</em></MenuItem>
          {states.map((s) => <MenuItem key={s.stateId} value={s.stateId}>{s.name}</MenuItem>)}
        </TextField>
      </Grid>

      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          select fullWidth label="District" required={required}
          value={districtId}
          disabled={!stateId}
          onChange={(e) => onChange({ districtId: Number(e.target.value) })}
        >
          <MenuItem value=""><em>{stateId ? "Select district" : "Select a state first"}</em></MenuItem>
          {districts.map((d) => <MenuItem key={d.districtId} value={d.districtId}>{d.name}</MenuItem>)}
        </TextField>
      </Grid>

      <Grid size={{ xs: 12, md: colSpan }}>
        <TextField
          fullWidth label="Pincode" required={required}
          value={pincode}
          inputProps={{ inputMode: "numeric", maxLength: 6 }}
          onChange={(e) => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          helperText="Enter 6 digits to auto-fill state & district"
          InputProps={{
            endAdornment: lookingUp.current
              ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment>
              : undefined,
          }}
        />
      </Grid>
    </>
  );
}

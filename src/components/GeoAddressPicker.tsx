import { useEffect, useRef } from "react";
import { Grid, TextField, MenuItem, InputAdornment, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../api/axios";

interface StateOption { stateId: number; name: string }

export interface GeoValue {
  stateId?: number | "" | null; // id-based forms (Hospital)
  stateName?: string;           // name-based forms (Patient/User/Supplier)
  city?: string;                // free-text city / town
  pincode?: string;
}

interface Props {
  value: GeoValue;
  /** Patch carries stateId AND stateName (+ city, pincode) so both id- and
   *  name-based forms can read what they store. */
  onChange: (patch: GeoValue) => void;
  colSpan?: number;
  required?: boolean;
  showPincode?: boolean;
}

/**
 * Address helper: State (dropdown from /api/geo) + free-text City + Pincode
 * (autofills the State when 6 digits are entered). The dataset has no city
 * master, so City is intentionally free text. Renders <Grid> items — use inside
 * a <Grid container>.
 */
export default function GeoAddressPicker({ value, onChange, colSpan = 4, required, showPincode = true }: Props) {
  const { data: states = [] } = useQuery<StateOption[]>({
    queryKey: ["geo-states"],
    queryFn: async () => (await axiosInstance.get("/geo/states")).data.data,
    staleTime: Infinity,
  });

  // Resolve the selected state: explicit id, else match a saved name once loaded.
  const stateId = value.stateId
    ? Number(value.stateId)
    : (value.stateName ? states.find((s) => s.name === value.stateName)?.stateId ?? "" : "");

  const city = value.city ?? "";
  const pincode = value.pincode ?? "";

  // Pincode autofill: 6 digits → set the State (city stays user-entered).
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
        if (d?.state?.stateId) onChange({ stateId: d.state.stateId, stateName: d.state.name, pincode: code });
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
            onChange({ stateId: id, stateName: states.find((s) => s.stateId === id)?.name ?? "" });
          }}
        >
          <MenuItem value=""><em>Select state</em></MenuItem>
          {states.map((s) => <MenuItem key={s.stateId} value={s.stateId}>{s.name}</MenuItem>)}
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
            helperText="6 digits — auto-fills state"
            InputProps={{ endAdornment: lookingUp.current ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> : undefined }}
          />
        </Grid>
      )}
    </>
  );
}

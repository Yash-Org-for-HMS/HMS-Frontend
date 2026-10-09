import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** A patient found by name, UHID or phone (the reception patient search). */
export interface PickedPatient { patientId: string; firstName: string | null; lastName: string | null; uhidNumber: string; phone?: string | null }

const patientLabel = (p: PickedPatient) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Patient";

export default function PatientPicker({ id, value, onChange, label = "Patient", required = true }: { id: string; value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; label?: string; required?: boolean }) {
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query, 300);
  const { data = [], isFetching } = useQuery<PickedPatient[]>({
    queryKey: ["mrd-patient-search", term],
    queryFn: async () => (await axiosInstance.get("/reception/patients", { params: { search: term, page: 1, limit: 20 } })).data.data || [],
    enabled: term.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
  return (
    <Autocomplete
      id={id}
      options={term.trim().length >= 2 ? data : []}
      value={value}
      onChange={(_e, p) => onChange(p)}
      // Only typing searches: picking a result sets the text to its label (reason "reset"), which is not a new search.
              onInputChange={(_, v, reason) => { if (reason === "input") setQuery(v); else if (reason === "clear") setQuery(""); }}
      getOptionLabel={(p) => `${patientLabel(p)} · ${p.uhidNumber}`}
      isOptionEqualToValue={(a, b) => a.patientId === b.patientId}
      filterOptions={(x) => x}
      loading={isFetching}
      noOptionsText={term.trim().length < 2 ? "Type a name, UHID or phone" : "No patient found"}
      renderOption={(props, p) => (
        <li {...props} key={p.patientId}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{patientLabel(p)}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.uhidNumber}{p.phone ? ` · ${p.phone}` : ""}</Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} required={required} />}
    />
  );
}

import { Box, TextField, MenuItem, FormControlLabel, Checkbox, Typography } from "@mui/material";

export interface DynFormField {
  formFieldId?: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string; // text | number | date | dropdown | checkbox
  isRequired?: boolean;
  validationRulesJson?: {
    options?: string[];
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  } | null;
}

export type FormValues = Record<string, any>;

/**
 * Validate a set of responses against a template's field definitions.
 * Returns a map of fieldName -> error message (empty map = valid). Used by
 * consumers (e.g. the consent issue dialog) before persisting responseDataJson.
 */
export function validateFormResponses(fields: DynFormField[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.fieldName];
    const r = f.validationRulesJson || {};

    const isEmpty = f.fieldType === "checkbox" ? !v : v === undefined || v === null || String(v).trim() === "";
    if (f.isRequired && isEmpty) {
      errors[f.fieldName] = "This field is required";
      continue;
    }
    if (isEmpty) continue; // optional + empty → nothing more to check

    if (f.fieldType === "text") {
      const s = String(v);
      if (r.minLength != null && s.length < r.minLength) errors[f.fieldName] = `Must be at least ${r.minLength} characters`;
      else if (r.maxLength != null && s.length > r.maxLength) errors[f.fieldName] = `Must be at most ${r.maxLength} characters`;
      else if (r.pattern) {
        try {
          if (!new RegExp(r.pattern).test(s)) errors[f.fieldName] = "Invalid format";
        } catch {
          /* an invalid stored regex shouldn't block submission */
        }
      }
    } else if (f.fieldType === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) errors[f.fieldName] = "Must be a number";
      else if (r.min != null && n < r.min) errors[f.fieldName] = `Must be at least ${r.min}`;
      else if (r.max != null && n > r.max) errors[f.fieldName] = `Must be at most ${r.max}`;
    }
  }
  return errors;
}

interface Props {
  fields: DynFormField[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  errors?: Record<string, string>;
}

/** Renders a FormBuilder template's fields as live inputs (controlled). */
export default function DynamicFormRenderer({ fields, values, onChange, errors = {} }: Props) {
  const set = (name: string, value: any) => onChange({ ...values, [name]: value });

  if (!fields || fields.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {fields.map((f) => {
        const label = f.fieldLabel + (f.isRequired ? " *" : "");
        const err = errors[f.fieldName];
        const val = values[f.fieldName] ?? (f.fieldType === "checkbox" ? false : "");

        if (f.fieldType === "checkbox") {
          return (
            <Box key={f.fieldName}>
              <FormControlLabel
                control={<Checkbox checked={!!val} onChange={(e) => set(f.fieldName, e.target.checked)} />}
                label={<Typography variant="body2">{label}</Typography>}
              />
              {err && <Typography variant="caption" sx={{ color: "error.main", display: "block", ml: 4 }}>{err}</Typography>}
            </Box>
          );
        }

        if (f.fieldType === "dropdown") {
          return (
            <TextField
              key={f.fieldName} select fullWidth size="small" label={label}
              value={val} onChange={(e) => set(f.fieldName, e.target.value)} error={!!err} helperText={err || undefined}
            >
              <MenuItem value="">—</MenuItem>
              {(f.validationRulesJson?.options || []).filter(Boolean).map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          );
        }

        const type = f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text";
        return (
          <TextField
            key={f.fieldName} fullWidth size="small" type={type} label={label}
            value={val} onChange={(e) => set(f.fieldName, e.target.value)}
            error={!!err} helperText={err || undefined}
            InputLabelProps={type === "date" ? { shrink: true } : undefined}
          />
        );
      })}
    </Box>
  );
}

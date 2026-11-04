import { Box, Typography, Radio, RadioGroup, FormControlLabel, TextField } from "@mui/material";
import { SEMANTIC, alpha } from "@/styles/accents";
import { writesOff, type OutstandingMedicine, type MedicineChoice, type MedicineChoices } from "./voidMedicines";

/**
 * Voiding a bill that carried medicines: each one is declared returned (it goes
 * back on the shelf, to the batch it came from) or not returned (written off,
 * with a reason, once an administrator approves the void). The server refuses a
 * void that leaves any medicine undeclared, so this is not optional.
 */
export default function VoidMedicinesDeclaration({
  medicines, choices, onChange,
}: {
  medicines: OutstandingMedicine[];
  choices: MedicineChoices;
  onChange: (next: MedicineChoices) => void;
}) {
  if (!medicines.length) return null;
  const set = (id: string, patch: Partial<MedicineChoice>) => {
    const prev = choices[id] ?? { returned: null, reason: "" };
    onChange({ ...choices, [id]: { ...prev, ...patch } });
  };
  const anyNotReturned = writesOff(medicines, choices);

  return (
    <Box sx={{ mb: 2, p: 1.75, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
        Medicines on this bill
      </Typography>
      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5 }}>
        Say for each one whether it came back to the pharmacy. Returned medicines go back on the shelf;
        one not returned is written off.
      </Typography>
      {medicines.map((m) => {
        const c = choices[m.medicineId];
        return (
          <Box key={m.medicineId} sx={{ py: 0.75, borderTop: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 140, fontWeight: 600 }} noWrap>
                {m.medicineName}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                Qty {m.returnable}
              </Typography>
              <RadioGroup
                row
                value={c?.returned == null ? "" : c.returned ? "returned" : "not"}
                onChange={(e) => set(m.medicineId, { returned: e.target.value === "returned" })}
              >
                <FormControlLabel value="returned" control={<Radio size="small" />} label={<Typography variant="body2">Returned</Typography>} />
                <FormControlLabel value="not" sx={{ mr: 0 }} control={<Radio size="small" />} label={<Typography variant="body2">Not returned</Typography>} />
              </RadioGroup>
            </Box>
            {c?.returned === false && (
              <TextField
                fullWidth size="small" label="Why not returned (required)"
                placeholder="e.g. seal broken, patient kept it"
                value={c.reason} onChange={(e) => set(m.medicineId, { reason: e.target.value })}
                error={c.reason.trim().length > 0 && c.reason.trim().length < 3}
                sx={{ mt: 0.75 }}
              />
            )}
          </Box>
        );
      })}
      {anyNotReturned && (
        <Typography
          variant="caption"
          sx={{
            display: "block", mt: 1, p: 1, borderRadius: 1,
            bgcolor: alpha(SEMANTIC.warning, 0.08), color: SEMANTIC.warningDark, fontWeight: 600,
          }}
        >
          A medicine not returned needs an administrator's approval - the bill is voided, and the medicine
          written off, once another administrator approves it.
        </Typography>
      )}
    </Box>
  );
}

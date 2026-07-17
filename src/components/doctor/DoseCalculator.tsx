import { ACCENTS } from "@/styles/accents";
import { useState } from "react";
import {
  IconButton, Popover, Box, Typography, TextField, Button, Chip, Divider, Tooltip,
  RadioGroup, FormControlLabel, Radio, Alert,
} from "@mui/material";
import { CalculateRounded } from "@mui/icons-material";

const DOCTOR_BLUE = ACCENTS.doctor;

interface Props {
  ageYears?: number | null;
  weightKg?: number | null;
  onApply: (mg: number) => void;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Pediatric dose ESTIMATE helper. Derives a child's dose as a fraction of the
 * known adult dose using standard pharmacology formulas:
 *   - Young's rule (age):    adult x age / (age + 12)
 *   - Clark's rule (weight): adult x weight(kg) / 70
 * This is a calculation aid, not authoritative dosing — the doctor confirms.
 */
export default function DoseCalculator({ ageYears, weightKg, onApply }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [adultDose, setAdultDose] = useState<string>("");
  const [weight, setWeight] = useState<string>(weightKg != null ? String(weightKg) : "");
  const [method, setMethod] = useState<"clark" | "young">(weightKg != null ? "clark" : "young");

  const adult = Number(adultDose) || 0;
  const wt = Number(weight) || 0;
  const hasAge = ageYears != null && ageYears > 0;

  const youngDose = hasAge && adult > 0 ? round(adult * (ageYears! / (ageYears! + 12))) : null;
  const clarkDose = wt > 0 && adult > 0 ? round(adult * (wt / 70)) : null;

  const chosen = method === "clark" ? clarkDose : youngDose;

  const close = () => setAnchorEl(null);

  const apply = () => {
    if (chosen && chosen > 0) {
      onApply(chosen);
      close();
    }
  };

  return (
    <>
      <Tooltip title="Estimate pediatric dose">
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: DOCTOR_BLUE }}>
          <CalculateRounded fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 320, p: 2, borderRadius: 2 } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Pediatric dose estimate</Typography>

        <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          <Chip size="small" label={hasAge ? `Age: ${ageYears} y` : "Age: unknown"} />
          <Chip size="small" label={wt > 0 ? `Weight: ${wt} kg` : "Weight: —"} color={wt > 0 ? "default" : "warning"} variant={wt > 0 ? "filled" : "outlined"} />
        </Box>

        <TextField
          fullWidth size="small" type="number" label="Adult reference dose (mg)"
          placeholder="e.g. 500" value={adultDose} onChange={(e) => setAdultDose(e.target.value)}
          sx={{ mb: 1.5 }} autoFocus
        />
        <TextField
          fullWidth size="small" type="number" label="Weight (kg)"
          value={weight} onChange={(e) => setWeight(e.target.value)} sx={{ mb: 1.5 }}
          helperText={weightKg == null ? "Not on file — enter for a weight-based estimate" : undefined}
        />

        <Divider sx={{ my: 1 }} />

        <RadioGroup value={method} onChange={(e) => setMethod(e.target.value as "clark" | "young")}>
          <FormControlLabel
            value="clark"
            disabled={clarkDose == null}
            control={<Radio size="small" />}
            label={
              <Typography variant="body2">
                Clark's (weight): <b>{clarkDose != null ? `${clarkDose} mg` : "—"}</b>
                <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>more accurate</Typography>
              </Typography>
            }
          />
          <FormControlLabel
            value="young"
            disabled={youngDose == null}
            control={<Radio size="small" />}
            label={
              <Typography variant="body2">
                Young's (age): <b>{youngDose != null ? `${youngDose} mg` : "—"}</b>
              </Typography>
            }
          />
        </RadioGroup>

        <Alert severity="info" sx={{ mt: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.72rem" } }}>
          Estimate from standard formulas. Verify against the drug's pediatric guidance.
        </Alert>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
          <Button size="small" color="inherit" onClick={close}>Cancel</Button>
          <Button size="small" variant="contained" onClick={apply} disabled={!chosen || chosen <= 0} sx={{ bgcolor: DOCTOR_BLUE }}>
            Use {chosen ? `${chosen} mg` : "dose"}
          </Button>
        </Box>
      </Popover>
    </>
  );
}

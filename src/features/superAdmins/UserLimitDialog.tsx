import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, RadioGroup, FormControlLabel, Radio, Alert,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import type { UserCapacityQuota } from "./hospitalOverview.types";

/**
 * The super admin sets how many logins one hospital may have: its own number,
 * or its plan's. Lowering it below the logins it already has switches nobody
 * off — it only stops more being added until some are removed.
 */
export default function UserLimitDialog({ hospitalId, hospitalName, capacity, onClose }: {
  hospitalId: string;
  hospitalName: string;
  capacity: UserCapacityQuota;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const planDefault = capacity.planLimit ?? 50;
  const [mode, setMode] = useState<"plan" | "own">(capacity.source === "hospital" ? "own" : "plan");
  const [value, setValue] = useState(String(capacity.limit));
  const own = Number(value);
  const valid = mode === "plan" || (Number.isInteger(own) && own >= 1 && own <= 100000);
  const next = mode === "plan" ? planDefault : own;

  const save = useMutation({
    mutationFn: async () => (await axiosInstance.put(`/hospitals/${hospitalId}/user-limit`, { userLimit: mode === "plan" ? null : own })).data.data,
    onSuccess: () => {
      toast.success("User limit updated");
      queryClient.invalidateQueries({ queryKey: ["hospital-overview", hospitalId] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Couldn't change the user limit")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>User limit — {hospitalName}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {capacity.used} login{capacity.used === 1 ? "" : "s"} in use. Logins that are switched off don't count.
        </Typography>
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as "plan" | "own")}>
          <FormControlLabel value="plan" control={<Radio />}
            label={capacity.planName ? `The ${capacity.planName} plan's limit (${planDefault})` : `The standard limit (${planDefault})`} />
          <FormControlLabel value="own" control={<Radio />} label="This hospital's own limit" />
        </RadioGroup>
        {mode === "own" && (
          <TextField
            id="user-limit" label="Logins allowed" type="number" size="small" value={value}
            onChange={(e) => setValue(e.target.value)}
            error={!valid} helperText={!valid ? "A whole number from 1 to 100000" : " "}
            inputProps={{ min: 1, max: 100000, step: 1 }}
          />
        )}
        {valid && next < capacity.used && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Below the {capacity.used} logins in use: nobody is switched off, but no more can be added until {capacity.used - next + 1} are removed or the limit is raised.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()} sx={{ textTransform: "none", fontWeight: 600 }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

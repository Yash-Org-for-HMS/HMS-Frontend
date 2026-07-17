import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  hospitalId: string;
  plans: any[];
  /** The branch being edited; null = add mode. */
  editingBranch: any | null;
  onSaved: () => void;
}

// Shared themed dropdown menu styling (was duplicated inline on both selects).
const SELECT_MENU_PROPS = {
  MenuProps: {
    PaperProps: {
      sx: { bgcolor: "background.paper", color: "text.primary", border: "1px solid", borderColor: "divider", "& .MuiMenuItem-root": { py: 1.5, px: 2 } },
    },
  },
} as const;

/**
 * Add / edit a hospital branch. Extracted from HospitalForm — owns its own form
 * + loading state, seeded from `editingBranch` when opened. Behavior identical:
 * same POST/PUT endpoints, validation, error toast, and parent refresh via
 * `onSaved`.
 */
export default function BranchDialog({ open, onClose, hospitalId, plans, editingBranch, onSaved }: Props) {
  const toast = useToast();
  const [branch, setBranch] = useState({ name: "", subscriptionPlanId: "", status: "active" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingBranch) {
      setBranch({ name: editingBranch.branchName, subscriptionPlanId: editingBranch.subscriptionPlanId || "", status: editingBranch.status || "active" });
    } else {
      setBranch({ name: "", subscriptionPlanId: "", status: "active" });
    }
  }, [open, editingBranch]);

  const handleSubmit = async () => {
    if (!branch.name) return;
    setLoading(true);
    try {
      if (editingBranch) {
        // Branch code is auto-assigned and immutable — not sent on edit.
        await axiosInstance.put(`/hospitals/${hospitalId}/branches/${editingBranch.branchId}`, {
          branchName: branch.name,
          subscriptionPlanId: branch.subscriptionPlanId || undefined,
          status: branch.status,
        });
      } else {
        // No branchCode sent — the server generates a unique one.
        await axiosInstance.post(`/hospitals/${hospitalId}/branches`, {
          branchName: branch.name,
          subscriptionPlanId: branch.subscriptionPlanId || undefined,
          status: branch.status,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save branch"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3, minWidth: 400 } }}>
      <DialogTitle sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
        {editingBranch ? "Edit Branch" : "Add New Branch"}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <TextField
          fullWidth
          label="Branch Name"
          value={branch.name}
          onChange={(e) => setBranch({ ...branch, name: e.target.value })}
          inputProps={{ maxLength: 100 }}
          placeholder="e.g. Main Hospital"
          sx={{ mt: 1 }}
          helperText={editingBranch ? undefined : "A unique branch code is assigned automatically."}
        />
        <TextField
          select
          fullWidth
          label="Subscription Plan"
          value={branch.subscriptionPlanId}
          onChange={(e) => setBranch({ ...branch, subscriptionPlanId: e.target.value })}
          SelectProps={SELECT_MENU_PROPS}
        >
          <MenuItem value="">No Subscription Plan</MenuItem>
          {plans.map((plan: any) => (
            <MenuItem key={plan.planId} value={plan.planId}>{plan.planName}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          label="Status"
          value={branch.status}
          onChange={(e) => setBranch({ ...branch, status: e.target.value })}
          SelectProps={SELECT_MENU_PROPS}
        >
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="suspended">Suspended</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!branch.name || loading}
          sx={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
        >
          {loading ? "Adding..." : "Add Branch"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

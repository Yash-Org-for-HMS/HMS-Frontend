import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button, Menu, MenuItem, ListItemText, IconButton, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Tooltip,
} from "@mui/material";
import {
  AutoAwesomeMotionRounded, AddRounded, DeleteOutlineRounded, KeyboardArrowDownRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

export interface RadiologyMacro {
  macroId: string;
  title: string;
  content: string;
}

/**
 * Report templates for radiology, authored where they are used.
 *
 * Deliberately the same shape as the doctor's SOAP template bar: pick one to
 * paste it in, save what you have written as a new one, delete the ones that
 * stopped being useful. A radiologist writing the same "unremarkable" paragraph
 * for the tenth time should be able to keep it without leaving the report.
 *
 * Reading these already worked — the picker existed. Nothing could WRITE one,
 * so the table stayed empty and the picker never had anything to offer.
 *
 * Unlike SOAP templates, these belong to the hospital rather than one author: a
 * reporting standard for a CT abdomen is the department's.
 */
export default function RadiologyMacroBar({
  content, onApply,
}: {
  /** The notes as they stand — what "Save current report" would store. */
  content: string;
  onApply: (m: RadiologyMacro) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: macros = [], isLoading } = useQuery<RadiologyMacro[]>({
    queryKey: ["radiology-macros"],
    queryFn: async () => (await axiosInstance.get("/lab/radiology-macros")).data?.data ?? [],
  });

  const apply = (m: RadiologyMacro) => {
    onApply(m);
    setAnchorEl(null);
  };

  const remove = async (e: React.MouseEvent, m: RadiologyMacro) => {
    e.stopPropagation();
    const yes = await confirm({
      title: "Delete template",
      message: `Delete template "${m.title}"? Reports already written keep their text.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!yes) return;
    try {
      await axiosInstance.delete(`/lab/radiology-macros/${m.macroId}`);
      toast.success("Template deleted");
      await qc.invalidateQueries({ queryKey: ["radiology-macros"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not delete the template"));
    }
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await axiosInstance.post("/lab/radiology-macros", { title: name.trim(), content });
      toast.success("Template saved");
      setSaveOpen(false);
      setName("");
      await qc.invalidateQueries({ queryKey: ["radiology-macros"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save the template"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AutoAwesomeMotionRounded />}
        endIcon={<KeyboardArrowDownRounded />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ textTransform: "none", fontWeight: 600, borderColor: "divider", color: "text.primary" }}
      >
        Templates
      </Button>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { minWidth: 280, maxHeight: 380 } }}>
        {isLoading ? (
          <ListSkeleton />
        ) : macros.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5, maxWidth: 260 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No templates yet. Write a report, then save it as one to reuse.
            </Typography>
          </Box>
        ) : (
          macros.map((m) => (
            <MenuItem key={m.macroId} onClick={() => apply(m)} sx={{ pr: 1 }}>
              <ListItemText
                primary={m.title}
                secondary={m.content}
                primaryTypographyProps={{ fontWeight: 600 }}
                secondaryTypographyProps={{ noWrap: true, fontSize: "0.72rem" }}
              />
              <Tooltip title="Delete">
                <IconButton size="small" onClick={(e) => remove(e, m)} sx={{ ml: 1 }}>
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </MenuItem>
          ))
        )}

        <Divider />
        <MenuItem
          onClick={() => { setAnchorEl(null); setSaveOpen(true); }}
          disabled={!content.trim()}
        >
          <AddRounded fontSize="small" style={{ marginRight: 8 }} />
          <ListItemText
            primary="Save current report as template"
            secondary={content.trim() ? undefined : "Write the report first"}
            primaryTypographyProps={{ fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: "0.72rem" }}
          />
        </MenuItem>
      </Menu>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Save as template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            The report text as it stands is stored under this name, for anyone reporting in this hospital.
          </Typography>
          <TextField
            autoFocus fullWidth size="small" label="Template name"
            placeholder="e.g. CT Abdomen — normal study"
            value={name} onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSaveOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained" onClick={save}
            disabled={saving || !name.trim()}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {saving ? "Saving…" : "Save template"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

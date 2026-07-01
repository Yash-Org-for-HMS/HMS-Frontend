import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button, Menu, MenuItem, ListItemText, IconButton, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Tooltip,
} from "@mui/material";
import {
  AutoAwesomeMotionRounded, AddRounded, DeleteOutlineRounded, KeyboardArrowDownRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";

const DOCTOR_BLUE = "#3b82f6";

export interface SoapTemplate {
  templateId: string;
  name: string;
  soapSubjective?: string | null;
  soapObjective?: string | null;
  soapAssessment?: string | null;
  soapPlan?: string | null;
  diagnosis?: string | null;
}

interface Props {
  current: {
    soapSubjective: string;
    soapObjective: string;
    soapAssessment: string;
    soapPlan: string;
    diagnosis: string;
  };
  onApply: (t: SoapTemplate) => void;
}

const stripHtml = (v?: string | null) => (v || "").replace(/<[^>]*>/g, "").trim();

export default function SoapTemplateBar({ current, onApply }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-templates"],
    queryFn: async () => (await axiosInstance.get("/doctor/templates")).data.data as SoapTemplate[],
  });
  const templates = data || [];

  const currentHasContent =
    [current.soapSubjective, current.soapObjective, current.soapAssessment, current.soapPlan].some((v) => stripHtml(v)) ||
    !!current.diagnosis?.trim();

  const handleApply = (t: SoapTemplate) => {
    setAnchorEl(null);
    if (currentHasContent && !window.confirm(`Replace the current SOAP notes with "${t.name}"?`)) return;
    onApply(t);
    toast.success(`Applied "${t.name}"`);
  };

  const handleDelete = async (e: React.MouseEvent, t: SoapTemplate) => {
    e.stopPropagation();
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await axiosInstance.delete(`/doctor/templates/${t.templateId}`);
      queryClient.invalidateQueries({ queryKey: ["doctor-templates"] });
      toast.success("Template deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete template");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    try {
      setSaving(true);
      await axiosInstance.post("/doctor/templates", {
        name: name.trim(),
        soapSubjective: current.soapSubjective,
        soapObjective: current.soapObjective,
        soapAssessment: current.soapAssessment,
        soapPlan: current.soapPlan,
        diagnosis: current.diagnosis,
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-templates"] });
      toast.success("Template saved");
      setSaveOpen(false);
      setName("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save template");
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

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { minWidth: 260, maxHeight: 380 } }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <HeartbeatLoader size={96} />
          </Box>
        ) : templates.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No templates yet. Fill the SOAP notes, then save them as a reusable template.
            </Typography>
          </Box>
        ) : (
          templates.map((t) => (
            <MenuItem key={t.templateId} onClick={() => handleApply(t)} sx={{ pr: 1 }}>
              <ListItemText
                primary={t.name}
                secondary={t.diagnosis || undefined}
                primaryTypographyProps={{ fontWeight: 600 }}
                secondaryTypographyProps={{ noWrap: true, fontSize: "0.72rem" }}
              />
              <Tooltip title="Delete">
                <IconButton size="small" edge="end" onClick={(e) => handleDelete(e, t)} sx={{ ml: 1, color: "text.secondary", "&:hover": { color: "#ef4444" } }}>
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </MenuItem>
          ))
        )}
        <Divider />
        <MenuItem onClick={() => { setAnchorEl(null); setSaveOpen(true); }} sx={{ color: DOCTOR_BLUE, fontWeight: 600 }}>
          <AddRounded fontSize="small" sx={{ mr: 1 }} /> Save current as template…
        </MenuItem>
      </Menu>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save SOAP template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Saves the current Subjective / Objective / Assessment / Plan and diagnosis as a reusable template.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Template name"
            placeholder="e.g. Fever / URI, ANC visit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSaveOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
            sx={{ bgcolor: DOCTOR_BLUE }}
          >
            Save template
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

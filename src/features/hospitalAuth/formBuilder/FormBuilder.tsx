import { useState, useEffect } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  IconButton,
  Switch,
  FormControlLabel,
  MenuItem,
  Tooltip,
  Chip,
  alpha,
} from "@mui/material";
import { SaveRounded, DeleteRounded, AddCircleOutlineRounded, DragIndicatorRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import FormSkeleton from "@/components/skeletons/FormSkeleton";

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "number", label: "Number Input" },
  { value: "date", label: "Date Picker" },
  { value: "dropdown", label: "Dropdown Select" },
  { value: "checkbox", label: "Checkbox" },
];

export default function FormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState({
    formName: "",
    formType: "Patient Registration",
    description: "",
  });

  const [fields, setFields] = useState<any[]>([]);

  const { data: template, isLoading: templateLoading, isError, error, refetch } = useQuery({
    queryKey: ["form-template", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/form-builder/${id}`)).data.data,
    enabled: isEditing,
  });

  // Seed the builder with the existing template when editing.
  useEffect(() => {
    if (!template) return;
    setFormData({
      formName: template.formName || "",
      formType: template.formType || "",
      description: template.description || "",
    });
    setFields(template.fields || []);
  }, [template]);

  const initialLoad = isEditing && templateLoading;

  const handleAddDataField = () => {
    setFields([
      ...fields,
      {
        fieldLabel: "",
        fieldType: "text",
        isRequired: false,
        validationRulesJson: {},
      }
    ]);
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const updated = [...fields];
    updated[index][key] = value;
    
    // Auto generate fieldName from fieldLabel if it's new
    if (key === "fieldLabel" && !updated[index].formFieldId) {
      updated[index].fieldName = value.toLowerCase().replace(/[^a-z0-9]/g, "_");
    }
    
    setFields(updated);
  };

  const handleRemoveField = (index: number) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  // Set/clear a single validation rule on a field (kept alongside dropdown options).
  const setRule = (index: number, key: string, raw: string) => {
    const rules = { ...(fields[index].validationRulesJson || {}) };
    if (raw === "") {
      delete rules[key];
    } else {
      rules[key] = key === "pattern" ? raw : Number(raw);
    }
    handleFieldChange(index, "validationRulesJson", rules);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Prepare fields with sort order
    const processedFields = fields.map((f, i) => ({
      ...f,
      sortOrder: String(i)
    }));

    const payload = {
      ...formData,
      fields: processedFields,
    };

    try {
      if (isEditing) {
        await axiosInstance.put(`/hospital/form-builder/${id}`, payload);
      } else {
        await axiosInstance.post(`/hospital/form-builder`, payload);
      }
      navigate("/hospital/form-builder");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save template"));
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <FormSkeleton />
    );
  }

  if (isError) {
    return <Box sx={{ p: 4 }}><ErrorState message={getApiErrorMessage(error, "Failed to load template")} onRetry={refetch} /></Box>;
  }

  // Focused fields adopt the hospital accent; everything else follows the theme.
  const textFieldProps = {
    fullWidth: true,
    sx: { "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: ACCENTS.hospital } },
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <PageHeader
        title={isEditing ? "Edit Form Template" : "Form Builder"}
        subtitle="Design your form by adding and configuring fields dynamically."
        actions={
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/form-builder")}
            sx={{ color: "text.secondary", borderColor: "divider" }}
          >
            Cancel
          </Button>
        }
      />
<form onSubmit={handleSave}>
        <Grid container spacing={4}>
          {/* Left Panel - Metadata */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 3, bgcolor: "background.paper", borderRadius: 2, position: { md: "sticky" }, top: 16 }}>
              <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 600 }}>Form Details</Typography>
              
              <TextField
                label="Form Name"
                value={formData.formName}
                onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
                required
                {...textFieldProps}
                sx={{ mb: 3, ...textFieldProps.sx }}
              />

              <TextField
                select
                label="Form Category"
                value={formData.formType}
                onChange={(e) => setFormData({ ...formData, formType: e.target.value })}
                required
                {...textFieldProps}
                sx={{ mb: 3, ...textFieldProps.sx }}
              >
                <MenuItem value="Patient Registration">Patient Registration</MenuItem>
                <MenuItem value="Consent Form">Consent Form</MenuItem>
                <MenuItem value="Clinical Intake">Clinical Intake</MenuItem>
                <MenuItem value="Insurance">Insurance</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>

              <TextField
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                {...textFieldProps}
              />
            </Paper>
          </Grid>

          {/* Right Panel - Fields Builder. minWidth:0 so wide field content can't
              stretch this column horizontally (MUI Grid items default to min-width:auto). */}
          <Grid size={{ xs: 12, md: 8 }} sx={{ minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, bgcolor: "background.paper", borderRadius: 2, minHeight: 400, overflow: "hidden" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Form Fields</Typography>
                  {fields.length > 0 && (
                    <Chip size="small" label={fields.length} sx={{ height: 22, fontWeight: 700, bgcolor: alpha(ACCENTS.hospital, 0.12), color: ACCENTS.hospital }} />
                  )}
                </Box>
                <Button
                  startIcon={<AddCircleOutlineRounded />}
                  onClick={handleAddDataField}
                  variant="contained"
                  disableElevation
                  sx={{ textTransform: "none", fontWeight: 600, bgcolor: ACCENTS.hospital, "&:hover": { bgcolor: ACCENTS.hospitalDark } }}
                >
                  Add Field
                </Button>
              </Box>

              {fields.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center", border: "2px dashed", borderColor: "divider", borderRadius: 2 }}>
                  <Mascot pose="nothing-here-yet" subtitle="No fields added yet." size={120} sx={{ py: 1 }} />
                  <Box sx={{ mb: 2 }} />
                  <Button variant="outlined" startIcon={<AddCircleOutlineRounded />} onClick={handleAddDataField}
                    sx={{ textTransform: "none", color: ACCENTS.hospital, borderColor: alpha(ACCENTS.hospital, 0.5), "&:hover": { borderColor: ACCENTS.hospital, bgcolor: alpha(ACCENTS.hospital, 0.06) } }}>
                    Add First Field
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {fields.map((field, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", borderColor: "divider" }}>
                      {/* Card header: index + remove */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                        <DragIndicatorRounded sx={{ color: "text.disabled", fontSize: 20, cursor: "grab" }} />
                        <Typography sx={{ fontWeight: 700, fontSize: "0.72rem", letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary" }}>Field {idx + 1}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title="Remove field">
                          <IconButton size="small" onClick={() => handleRemoveField(idx)} sx={{ color: SEMANTIC.danger }}>
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Label + input type (flex, not Grid-in-flex — minWidth:0 lets them shrink, no overflow) */}
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                        <TextField label="Field Label (Question)" value={field.fieldLabel} onChange={(e) => handleFieldChange(idx, "fieldLabel", e.target.value)} required size="small" sx={{ flex: "2 1 220px", minWidth: 0 }} />
                        <TextField select label="Input Type" value={field.fieldType} onChange={(e) => handleFieldChange(idx, "fieldType", e.target.value)} required size="small" sx={{ flex: "1 1 150px", minWidth: 0 }}>
                          {FIELD_TYPES.map(ft => <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>)}
                        </TextField>
                      </Box>

                      {/* Type-specific validation */}
                      {field.fieldType === "dropdown" && (
                        <TextField label="Dropdown Options (comma separated)" value={field.validationRulesJson?.options?.join(", ") || ""}
                          onChange={(e) => { const opts = e.target.value.split(",").map((s: string) => s.trim()); handleFieldChange(idx, "validationRulesJson", { ...field.validationRulesJson, options: opts }); }}
                          placeholder="e.g. Option 1, Option 2, Option 3" fullWidth size="small" sx={{ mt: 1.5 }} />
                      )}
                      {field.fieldType === "text" && (
                        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1.5 }}>
                          <TextField size="small" type="number" label="Min length" value={field.validationRulesJson?.minLength ?? ""} onChange={(e) => setRule(idx, "minLength", e.target.value)} sx={{ width: 120 }} />
                          <TextField size="small" type="number" label="Max length" value={field.validationRulesJson?.maxLength ?? ""} onChange={(e) => setRule(idx, "maxLength", e.target.value)} sx={{ width: 120 }} />
                          <TextField size="small" label="Pattern (regex)" value={field.validationRulesJson?.pattern ?? ""} onChange={(e) => setRule(idx, "pattern", e.target.value)} placeholder="e.g. ^[0-9]{10}$" sx={{ flex: "1 1 160px", minWidth: 0 }} />
                        </Box>
                      )}
                      {field.fieldType === "number" && (
                        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1.5 }}>
                          <TextField size="small" type="number" label="Min value" value={field.validationRulesJson?.min ?? ""} onChange={(e) => setRule(idx, "min", e.target.value)} sx={{ width: 130 }} />
                          <TextField size="small" type="number" label="Max value" value={field.validationRulesJson?.max ?? ""} onChange={(e) => setRule(idx, "max", e.target.value)} sx={{ width: 130 }} />
                        </Box>
                      )}

                      {/* Footer: required + generated name */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mt: 1.5, flexWrap: "wrap" }}>
                        <FormControlLabel control={<Switch size="small" checked={field.isRequired} onChange={(e) => handleFieldChange(idx, "isRequired", e.target.checked)} />}
                          label={<Typography variant="body2" sx={{ color: "text.secondary" }}>Required</Typography>} />
                        <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 0, wordBreak: "break-word" }}>name: <Box component="code" sx={{ color: "text.primary" }}>{field.fieldName || "—"}</Box></Typography>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={<SaveRounded />}
            sx={{ bgcolor: ACCENTS.hospital, "&:hover": { bgcolor: ACCENTS.hospitalDark }, py: 1.5, px: 4, fontWeight: 600, fontSize: "1rem" }}
          >
            {loading ? "Saving..." : "Save Form Template"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}

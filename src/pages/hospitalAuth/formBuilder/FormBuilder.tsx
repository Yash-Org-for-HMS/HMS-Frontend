import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Switch,
  FormControlLabel,
  MenuItem,
  Divider,
} from "@mui/material";
import { SaveRounded, DeleteRounded, AddCircleOutlineRounded, DragIndicatorRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import ErrorState from "../../../components/ErrorState";
import Mascot from "../../../components/Mascot";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";

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
    setLoading(true);    // Prepare fields with sort order
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save template");
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (isError) {
    return <Box sx={{ p: 4 }}><ErrorState message={(error as any)?.response?.data?.message || "Failed to load template"} onRetry={refetch} /></Box>;
  }

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "text.secondary" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "text.primary",
        "& fieldset": { borderColor: "divider" },
        "&:hover fieldset": { borderColor: "divider" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
      },
      "& .MuiInputLabel-root": { color: "text.secondary" }
    },
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
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
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

          {/* Right Panel - Fields Builder */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, minHeight: 400 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Form Fields</Typography>
                <Button
                  startIcon={<AddCircleOutlineRounded />}
                  onClick={handleAddDataField}
                  sx={{ color: "#38bdf8", textTransform: "none", fontWeight: 600 }}
                >
                  Add Field
                </Button>
              </Box>

              {fields.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 2 }}>
                  <Mascot pose="nothing-here-yet" subtitle="No fields added yet." size={120} sx={{ py: 1 }} />
                  <Box sx={{ mb: 2 }} />
                  <Button variant="outlined" onClick={handleAddDataField} sx={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.5)" }}>
                    Add First Field
                  </Button>
                </Box>
              ) : (
                <Box>
                  {fields.map((field, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                      <Box sx={{ pt: 2, color: "text.secondary" }}>
                        <DragIndicatorRounded />
                      </Box>
                      
                      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                        <Grid size={{xs: 12, sm: 6}}>
                          <TextField
                            label="Field Label (Question)"
                            value={field.fieldLabel}
                            onChange={(e) => handleFieldChange(idx, "fieldLabel", e.target.value)}
                            required
                            {...textFieldProps}
                          />
                        </Grid>
                        <Grid size={{xs: 12, sm: 6}}>
                          <TextField
                            select
                            label="Input Type"
                            value={field.fieldType}
                            onChange={(e) => handleFieldChange(idx, "fieldType", e.target.value)}
                            required
                            {...textFieldProps}
                          >
                            {FIELD_TYPES.map(ft => (
                              <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        
                        {field.fieldType === "dropdown" && (
                          <Grid size={{xs: 12}}>
                            <TextField
                              label="Dropdown Options (Comma separated)"
                              value={field.validationRulesJson?.options?.join(", ") || ""}
                              onChange={(e) => {
                                const opts = e.target.value.split(",").map((s: string) => s.trim());
                                handleFieldChange(idx, "validationRulesJson", { ...field.validationRulesJson, options: opts });
                              }}
                              placeholder="e.g. Option 1, Option 2, Option 3"
                              {...textFieldProps}
                            />
                          </Grid>
                        )}

                        {field.fieldType === "text" && (
                          <Grid size={{xs: 12}}>
                            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                              <TextField size="small" type="number" label="Min length" value={field.validationRulesJson?.minLength ?? ""} onChange={(e) => setRule(idx, "minLength", e.target.value)} sx={{ width: 130 }} />
                              <TextField size="small" type="number" label="Max length" value={field.validationRulesJson?.maxLength ?? ""} onChange={(e) => setRule(idx, "maxLength", e.target.value)} sx={{ width: 130 }} />
                              <TextField size="small" label="Pattern (regex)" value={field.validationRulesJson?.pattern ?? ""} onChange={(e) => setRule(idx, "pattern", e.target.value)} placeholder="e.g. ^[0-9]{10}$" sx={{ flex: 1, minWidth: 180 }} />
                            </Box>
                          </Grid>
                        )}
                        {field.fieldType === "number" && (
                          <Grid size={{xs: 12}}>
                            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                              <TextField size="small" type="number" label="Min value" value={field.validationRulesJson?.min ?? ""} onChange={(e) => setRule(idx, "min", e.target.value)} sx={{ width: 140 }} />
                              <TextField size="small" type="number" label="Max value" value={field.validationRulesJson?.max ?? ""} onChange={(e) => setRule(idx, "max", e.target.value)} sx={{ width: 140 }} />
                            </Box>
                          </Grid>
                        )}
                        
                        <Grid size={{xs: 12}} sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={field.isRequired}
                                onChange={(e) => handleFieldChange(idx, "isRequired", e.target.checked)}
                                color="primary"
                              />
                            }
                            label={<Typography sx={{ color: "text.secondary" }}>Required Field</Typography>}
                          />
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            Auto-generated name: <code>{field.fieldName || "..."}</code>
                          </Typography>
                        </Grid>
                      </Grid>

                      <IconButton onClick={() => handleRemoveField(idx)} sx={{ color: "#f43f5e", mt: 1 }}>
                        <DeleteRounded />
                      </IconButton>
                    </Box>
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
            sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1.5, px: 4, fontWeight: 600, fontSize: "1rem" }}
          >
            {loading ? "Saving..." : "Save Form Template"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}

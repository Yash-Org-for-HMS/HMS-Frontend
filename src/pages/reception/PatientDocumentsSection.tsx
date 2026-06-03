import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Grid, CircularProgress, Alert,
  Card, CardContent, CardActions, IconButton, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem
} from "@mui/material";
import {
  CloudUploadRounded, DeleteRounded, VisibilityRounded, InsertDriveFileRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function PatientDocumentsSection({ patientId }: { patientId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Upload form state
  const [selectedType, setSelectedType] = useState<any>("");
  const [file, setFile] = useState<File | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/reception/patients/${patientId}/documents`);
      if (res.data.success) {
        setDocuments(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const res = await axiosInstance.get("/reception/document-types");
      if (res.data.success) {
        setDocumentTypes(res.data.data);
      }
    } catch (err: any) {
      console.error("Failed to load document types", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
  }, [patientId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType) return;
    try {
      setUploading(true);
      setError("");
      
      const typeInfo = documentTypes.find(t => t.documentTypeId === selectedType);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentTypeId", selectedType);
      formData.append("documentType", typeInfo ? typeInfo.typeName : "Document");
      
      const res = await axiosInstance.post(`/reception/patients/${patientId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.success) {
        setUploadOpen(false);
        setFile(null);
        setSelectedType("");
        fetchDocuments();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      setLoading(true);
      const res = await axiosInstance.delete(`/reception/documents/${documentId}`);
      if (res.data.success) {
        fetchDocuments();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete document");
      setLoading(false);
    }
  };

  const getFileIcon = (_mimeType: string) => {
    return <InsertDriveFileRounded sx={{ fontSize: 40, color: "#94a3b8" }} />;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" sx={{ color: "#f1f5f9", fontWeight: 700 }}>
          Patient Documents
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<CloudUploadRounded />}
          onClick={() => setUploadOpen(true)}
          sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: "#0891b2" }, textTransform: "none", fontWeight: 600 }}
        >
          Upload Document
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: "center", py: 5 }}>
          <CircularProgress sx={{ color: "#06b6d4" }} />
        </Box>
      ) : documents.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, textAlign: "center", bgcolor: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 3 }}>
          <InsertDriveFileRounded sx={{ fontSize: 60, color: "#334155", mb: 2 }} />
          <Typography variant="h6" sx={{ color: "#94a3b8" }}>No documents found</Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 1 }}>
            Upload Aadhaar, Insurance Cards, or Referral Letters here.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {documents.map((doc) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={doc.patientDocumentId}>
              <Card sx={{ bgcolor: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3 }}>
                <CardContent sx={{ textAlign: "center", pb: 1 }}>
                  {getFileIcon(doc.mimeType)}
                  <Typography variant="subtitle2" sx={{ color: "#e2e8f0", mt: 2, fontWeight: 600 }} noWrap>
                    {doc.documentType}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.5 }}>
                    {doc.fileSizeKb} KB • {new Date(doc.createdAt).toLocaleDateString()}
                  </Typography>
                  <Chip 
                    label={doc.mimeType.split("/")[1]?.toUpperCase() || "FILE"} 
                    size="small" 
                    sx={{ mt: 1.5, bgcolor: "rgba(6,182,212,0.1)", color: "#06b6d4", fontSize: "0.65rem", fontWeight: 700 }}
                  />
                </CardContent>
                <CardActions sx={{ justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.05)", pt: 1, pb: 1.5 }}>
                  <IconButton 
                    size="small" 
                    component="a" 
                    href={doc.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    sx={{ color: "#94a3b8", "&:hover": { color: "#06b6d4" } }}
                  >
                    <VisibilityRounded fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(doc.patientDocumentId)}
                    sx={{ color: "#94a3b8", "&:hover": { color: "#ef4444" } }}
                  >
                    <DeleteRounded fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={uploadOpen} 
        onClose={() => !uploading && setUploadOpen(false)}
        PaperProps={{ sx: { bgcolor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, minWidth: 400 } }}
      >
        <DialogTitle sx={{ color: "#f1f5f9", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          Upload Document
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            select fullWidth
            label="Document Type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            sx={{ mb: 3, "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
          >
            {documentTypes.map(type => (
              <MenuItem key={type.documentTypeId} value={type.documentTypeId}>
                {type.typeName}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ 
              height: 100, 
              borderStyle: "dashed", 
              borderColor: "rgba(6,182,212,0.3)", 
              color: "#06b6d4",
              display: "flex", flexDirection: "column", gap: 1
            }}
          >
            <CloudUploadRounded />
            {file ? file.name : "Select File"}
            <input type="file" hidden onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <Button onClick={() => setUploadOpen(false)} sx={{ color: "#94a3b8" }} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={!file || !selectedType || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadRounded />}
            sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: "#0891b2" }, fontWeight: 600 }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

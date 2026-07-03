import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Grid, Alert,
  Card, CardContent, CardActions, IconButton, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem
} from "@mui/material";
import {
  CloudUploadRounded, DeleteRounded, VisibilityRounded, InsertDriveFileRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { useToast } from "../../contexts/ToastContext";

export default function PatientDocumentsSection({ patientId }: { patientId: string }) {
  const toast = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [selectedType, setSelectedType] = useState<any>("");
  const [file, setFile] = useState<File | null>(null);

  const { data: documents = [], isLoading: loading, isError, error, refetch: fetchDocuments } = useQuery<any[]>({
    queryKey: ["patient-documents", patientId],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${patientId}/documents`)).data.data || [],
  });

  // Document types feed the upload dropdown; load failures stay silent (as before).
  const { data: documentTypes = [] } = useQuery<any[]>({
    queryKey: ["document-types"],
    queryFn: async () => (await axiosInstance.get("/reception/document-types")).data.data || [],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType) return;
    try {
      setUploading(true);
      toast.error("");
      
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
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await axiosInstance.delete(`/reception/documents/${documentId}`);
      if (res.data.success) {
        fetchDocuments();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete document");
    }
  };

  const getFileIcon = (_mimeType: string) => {
    return <InsertDriveFileRounded sx={{ fontSize: 40, color: "text.secondary" }} />;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
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
{loading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message || "Failed to load documents"} onRetry={fetchDocuments} />
      ) : documents.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3, bgcolor: "action.hover", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
          <Mascot pose="nothing-here-yet" title="No documents found" subtitle="Upload Aadhaar, Insurance Cards, or Referral Letters here." size={130} />
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {documents.map((doc) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={doc.patientDocumentId}>
              <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
                <CardContent sx={{ textAlign: "center", pb: 1 }}>
                  {getFileIcon(doc.mimeType)}
                  <Typography variant="subtitle2" sx={{ color: "text.primary", mt: 2, fontWeight: 600 }} noWrap>
                    {doc.documentType}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                    {doc.fileSizeKb} KB • {new Date(doc.createdAt).toLocaleDateString()}
                  </Typography>
                  <Chip 
                    label={doc.mimeType.split("/")[1]?.toUpperCase() || "FILE"} 
                    size="small" 
                    sx={{ mt: 1.5, bgcolor: "rgba(6,182,212,0.1)", color: "#06b6d4", fontSize: "0.75rem", fontWeight: 700 }}
                  />
                </CardContent>
                <CardActions sx={{ justifyContent: "center", borderTop: "1px solid", borderColor: "divider", pt: 1, pb: 1.5 }}>
                  <IconButton 
                    size="small" 
                    component="a" 
                    href={doc.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4" } }}
                  >
                    <VisibilityRounded fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(doc.patientDocumentId)}
                    sx={{ color: "text.secondary", "&:hover": { color: "#ef4444" } }}
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
        PaperProps={{ sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, minWidth: 400 } }}
      >
        <DialogTitle sx={{ color: "text.primary", fontWeight: 700, borderBottom: "1px solid", borderColor: "divider" }}>
          Upload Document
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            select fullWidth
            label="Document Type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            sx={{ mb: 3, "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
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
        <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setUploadOpen(false)} sx={{ color: "text.secondary" }} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={!file || !selectedType || uploading}
            startIcon={uploading ? <HeartbeatLoader size={22} /> : <CloudUploadRounded />}
            sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: "#0891b2" }, fontWeight: 600 }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

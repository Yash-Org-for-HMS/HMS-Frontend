import { useEffect, useState } from "react";
import { Box, Typography, Divider, Grid } from "@mui/material";
import { useParams } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import { assetUrl } from "@/utils/assetUrl";
import { formatDate, formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

interface ConsentResponse {
  label: string;
  fieldType?: string | null;
  value: unknown;
}

interface ConsentPrintData {
  consentFormId: string;
  title?: string | null;
  status: string;
  signedByName?: string | null;
  signedByRelation?: string | null;
  witnessName?: string | null;
  signatureUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  issuedByName?: string | null;
  patient?: {
    name: string; uhid?: string | null; dateOfBirth?: string | null;
    gender?: string | null; phone?: string | null; address?: string | null;
  } | null;
  hospital?: {
    hospitalName?: string | null; addressLine1?: string | null; addressLine2?: string | null;
    city?: string | null; officialPhone?: string | null; officialEmail?: string | null; logoUrl?: string | null;
  } | null;
  responses: ConsentResponse[];
}

/** Checkboxes store booleans; a bare "true" on a signed document reads badly. */
const show = (v: unknown, fieldType?: string | null): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (fieldType === "date") return formatDate(String(v));
  return String(v);
};

/**
 * A signed consent as a document.
 *
 * The signature was captured and then only viewable as a loose image, so the
 * hospital had no way to produce the signed form itself — the one artefact a
 * consent exists to create. This prints the letterhead, who consented, what
 * they were asked and answered, and the signature block.
 */
export default function PrintConsentForm() {
  const { id } = useParams();
  const [form, setForm] = useState<ConsentPrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/reception/consent-forms/${id}`);
        if (!cancelled) setForm(res.data.data);
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, "Failed to load this consent form"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!loading && form) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, form]);

  if (loading) return <DetailSkeleton />;
  if (error) return <Typography color="error" sx={{ p: 4 }}>{error}</Typography>;
  if (!form) return <Typography sx={{ p: 4 }}>Consent form not found</Typography>;

  const h = form.hospital;
  const p = form.patient;
  const signed = form.status === "SIGNED";

  const label = { fontSize: "10pt", color: "#555" } as const;
  const value = { fontSize: "11pt", fontWeight: 600 } as const;

  return (
    <Box sx={{
      width: "210mm", minHeight: "297mm", margin: "0 auto",
      bgcolor: "white", color: "black", p: "20mm", boxSizing: "border-box",
      "@media screen": { boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", my: 4 },
      "@media print": { margin: 0, padding: "15mm", boxShadow: "none", width: "100%", minHeight: "100vh" },
    }}>
      {/* Letterhead */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 1 }}>
        {h?.logoUrl && <Box component="img" src={assetUrl(h.logoUrl)} alt="" sx={{ height: 52, objectFit: "contain" }} />}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "16pt", fontWeight: 700 }}>{h?.hospitalName || "Hospital"}</Typography>
          <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>
            {[h?.addressLine1, h?.addressLine2, h?.city].filter(Boolean).join(", ")}
          </Typography>
          <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>
            {[h?.officialPhone, h?.officialEmail].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "#000", borderBottomWidth: 2, mb: 2 }} />

      <Typography sx={{ fontSize: "13pt", fontWeight: 700, textAlign: "center", mb: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {form.title || "Consent Form"}
      </Typography>
      {/* An unsigned copy must not be mistaken for a signed one. */}
      <Typography sx={{ fontSize: "9.5pt", textAlign: "center", color: signed ? "#166534" : "#92400e", mb: 2.5, fontWeight: 600 }}>
        {signed ? "Signed copy" : form.status === "CANCELLED" ? "CANCELLED — not valid" : "Unsigned — for signature"}
      </Typography>

      {/* Patient */}
      <Grid container spacing={1.2} sx={{ mb: 2 }}>
        {([
          ["Patient", p?.name], ["UHID", p?.uhid],
          ["Date of birth", p?.dateOfBirth ? formatDate(p.dateOfBirth) : null],
          ["Gender", p?.gender], ["Phone", p?.phone], ["Address", p?.address],
        ] as [string, string | null | undefined][]).map(([k, v]) => (
          <Grid key={k} size={{ xs: 6 }}>
            <Typography sx={label}>{k}</Typography>
            <Typography sx={value}>{v || "—"}</Typography>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ mb: 2 }} />

      {/* What was asked, and what was answered. */}
      {form.responses.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: "10pt", fontWeight: 700, mb: 1.2, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Details recorded
          </Typography>
          {form.responses.map((r, i) => (
            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", gap: 3, py: 0.7, borderBottom: "1px solid #eee" }}>
              <Typography sx={{ fontSize: "10.5pt", color: "#333" }}>{r.label}</Typography>
              <Typography sx={{ fontSize: "10.5pt", fontWeight: 600, textAlign: "right" }}>{show(r.value, r.fieldType)}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Declaration — the sentence the signature is against. */}
      {/* Left-aligned, not justified: at this measure justification opens
          rivers of white space through a paragraph that has to read cleanly. */}
      <Typography sx={{ fontSize: "10.5pt", lineHeight: 1.75, mb: 3 }}>
        I confirm that the nature and purpose of the above has been explained to me in a language
        I understand, that I have had the opportunity to ask questions, and that I give my consent
        freely and without inducement.
      </Typography>

      {/* Signature block */}
      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid size={{ xs: 6 }}>
          <Box sx={{ minHeight: 68, display: "flex", alignItems: "flex-end", mb: 0.5 }}>
            {form.signatureUrl && (
              <Box component="img" src={assetUrl(form.signatureUrl)} alt="Signature"
                sx={{ maxHeight: 64, maxWidth: "100%", objectFit: "contain" }} />
            )}
          </Box>
          <Divider sx={{ borderColor: "#000" }} />
          <Typography sx={{ ...label, mt: 0.5 }}>Signature</Typography>
          <Typography sx={value}>{form.signedByName || "—"}</Typography>
          {form.signedByRelation && (
            <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>Relation to patient: {form.signedByRelation}</Typography>
          )}
          {signed && form.updatedAt && (
            <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>{formatDateTime(form.updatedAt)}</Typography>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Box sx={{ minHeight: 68 }} />
          <Divider sx={{ borderColor: "#000" }} />
          <Typography sx={{ ...label, mt: 0.5 }}>Witness</Typography>
          <Typography sx={value}>{form.witnessName || "—"}</Typography>
        </Grid>
      </Grid>

      <Box sx={{ mt: 5, pt: 1.5, borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "8.5pt", color: "#777" }}>
          Issued {form.createdAt ? formatDateTime(form.createdAt) : "—"}
          {form.issuedByName ? ` by ${form.issuedByName}` : ""}
        </Typography>
        <Typography sx={{ fontSize: "8.5pt", color: "#777", fontFamily: "monospace" }}>
          Ref {form.consentFormId.slice(0, 8).toUpperCase()}
        </Typography>
      </Box>
    </Box>
  );
}

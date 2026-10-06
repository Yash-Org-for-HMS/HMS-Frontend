import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, Divider } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { useAutoPrint } from "@/utils/useAutoPrint";
import { assetUrl } from "@/utils/assetUrl";
import { formatDate, formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

/**
 * A numbered certificate, printed (backend /mrd/certificates/:id). Opening
 * this page is a print: the first is the original, every later one carries
 * "DUPLICATE" — so a second copy can never pass as the first. A cancelled
 * certificate shows as cancelled and is not printed.
 */

interface Sheet {
  certificateId: string; certNumber: string; certType: "MEDICAL" | "FITNESS" | "DEATH"; status: "ISSUED" | "CANCELLED"; issuedAt: string;
  cancelReason: string | null; mlcNumber: string | null; details: Record<string, string | null>;
  hospital: { hospitalName?: string | null; branchName?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; officialPhone?: string | null; officialEmail?: string | null; logoUrl?: string | null } | null;
  patient: { name: string; uhid: string; dateOfBirth: string | null; gender: string | null; address: string } | null;
  doctor: { name: string; registration: string | null; qualification: string | null; department: string | null };
}

const TITLE = { MEDICAL: "Medical Certificate", FITNESS: "Certificate of Fitness", DEATH: "Medical Certificate of Cause of Death" } as const;
const MANNER: Record<string, string> = { NATURAL: "Natural", ACCIDENT: "Accident", SUICIDE: "Suicide", HOMICIDE: "Homicide", PENDING_INVESTIGATION: "Pending investigation" };
const ageOn = (dob: string | null, at: string) => (dob ? Math.floor((new Date(at).getTime() - new Date(dob).getTime()) / (365.25 * 86_400_000)) : null);

export default function PrintCertificate() {
  const { id } = useParams<{ id: string }>();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const marked = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await axiosInstance.get(`/mrd/certificates/${id}`)).data.data as Sheet;
        // Counted once per opening: one request, kept in a ref that survives
        // React's development double-run, so both runs read the same answer.
        if (s.status === "ISSUED") {
          marked.current ??= axiosInstance.post(`/mrd/certificates/${id}/printed`).then((r) => (r.data.data as { duplicate: boolean }).duplicate);
          const dup = await marked.current;
          if (!cancelled) setDuplicate(dup);
        }
        if (!cancelled) setSheet(s);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, "Couldn't load this certificate"));
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useAutoPrint(!!sheet && sheet.status === "ISSUED");

  if (error) return <Typography color="error" sx={{ p: 4 }}>{error}</Typography>;
  if (!sheet) return <DetailSkeleton />;

  const h = sheet.hospital;
  const p = sheet.patient;
  const d = sheet.details;
  const age = p ? ageOn(p.dateOfBirth, sheet.issuedAt) : null;
  const body = { fontSize: "11.5pt", lineHeight: 1.9 } as const;
  const strong = { fontWeight: 700 } as const;
  const who = <><Box component="span" sx={strong}>{p?.name || "—"}</Box>{age != null ? `, aged ${age} years` : ""}{p?.gender ? `, ${p.gender.toLowerCase()}` : ""}, UHID <Box component="span" sx={strong}>{p?.uhid}</Box></>;

  return (
    <Box sx={{
      width: "210mm", minHeight: "297mm", margin: "0 auto", position: "relative", overflow: "hidden",
      bgcolor: "white", color: "black", p: "20mm", boxSizing: "border-box",
      "@media screen": { boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", my: 4 },
      "@media print": { margin: 0, padding: "15mm", boxShadow: "none", width: "100%", minHeight: "100vh" },
    }}>
      {(duplicate || sheet.status === "CANCELLED") && (
        <Typography aria-hidden sx={{ position: "absolute", top: "42%", left: 0, right: 0, textAlign: "center", fontSize: "64pt", fontWeight: 800, color: "rgba(0,0,0,0.07)", transform: "rotate(-24deg)", pointerEvents: "none", letterSpacing: 6 }}>
          {sheet.status === "CANCELLED" ? "CANCELLED" : "DUPLICATE"}
        </Typography>
      )}

      {/* Letterhead */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 1 }}>
        {h?.logoUrl && <Box component="img" src={assetUrl(h.logoUrl)} alt="" sx={{ height: 52, objectFit: "contain" }} />}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "16pt", fontWeight: 700 }}>{h?.hospitalName || "Hospital"}</Typography>
          {h?.branchName && <Typography sx={{ fontSize: "10.5pt", fontWeight: 700 }}>{h.branchName}</Typography>}
          <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>{[h?.addressLine1, h?.addressLine2, h?.city].filter(Boolean).join(", ")}</Typography>
          <Typography sx={{ fontSize: "9.5pt", color: "#555" }}>{[h?.officialPhone, h?.officialEmail].filter(Boolean).join(" · ")}</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: "#000", borderBottomWidth: 2, mb: 1.5 }} />

      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "10pt", mb: 2 }}>
        <Typography sx={{ fontSize: "10pt" }}>No. <b>{sheet.certNumber}</b>{sheet.mlcNumber ? ` · MLC ${sheet.mlcNumber}` : ""}</Typography>
        <Typography sx={{ fontSize: "10pt" }}>Date: <b>{formatDate(sheet.issuedAt)}</b></Typography>
      </Box>

      <Typography sx={{ fontSize: "14pt", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.6, mb: 0.5 }}>{TITLE[sheet.certType]}</Typography>
      <Typography sx={{ fontSize: "9.5pt", textAlign: "center", fontWeight: 600, mb: 3, color: sheet.status === "CANCELLED" ? "#b91c1c" : duplicate ? "#92400e" : "#166534" }}>
        {sheet.status === "CANCELLED" ? `CANCELLED — not valid (${sheet.cancelReason ?? ""})` : duplicate ? "Duplicate copy" : "Original"}
      </Typography>

      {sheet.certType === "MEDICAL" && (
        <Typography sx={body}>
          This is to certify that {who}, was examined and treated at this hospital for <Box component="span" sx={strong}>{d.diagnosis}</Box>.
          {" "}In my opinion, rest is advised from <Box component="span" sx={strong}>{d.restFrom ? formatDate(d.restFrom) : "—"}</Box> to <Box component="span" sx={strong}>{d.restTo ? formatDate(d.restTo) : "—"}</Box>, both days inclusive.
          {d.remarks ? <><br />Remarks: {d.remarks}</> : null}
        </Typography>
      )}
      {sheet.certType === "FITNESS" && (
        <Typography sx={body}>
          This is to certify that I have examined {who}, and find them medically fit to <Box component="span" sx={strong}>{d.purpose}</Box> with effect from <Box component="span" sx={strong}>{d.fitFrom ? formatDate(d.fitFrom) : "—"}</Box>.
          {d.remarks ? <><br />Remarks: {d.remarks}</> : null}
        </Typography>
      )}
      {sheet.certType === "DEATH" && (
        <Box sx={body}>
          <Typography sx={body}>This is to certify that {who}, {p?.address ? `of ${p.address}, ` : ""}died at this hospital on <Box component="span" sx={strong}>{d.dateOfDeath ? formatDateTime(d.dateOfDeath) : "—"}</Box>.</Typography>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1.5, "& td": { border: "1px solid #999", p: "6px 8px", fontSize: "10.5pt", verticalAlign: "top" } }}>
            <tbody>
              <tr><td style={{ width: "42%" }}>I. (a) Immediate cause</td><td><b>{d.causeImmediate}</b></td></tr>
              <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;(b) Antecedent cause, due to</td><td>{d.causeAntecedent || "—"}</td></tr>
              <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;(c) Underlying cause</td><td>{d.causeUnderlying || "—"}</td></tr>
              <tr><td>II. Other significant conditions</td><td>{d.otherConditions || "—"}</td></tr>
              <tr><td>Manner of death</td><td><b>{MANNER[d.mannerOfDeath ?? ""] ?? d.mannerOfDeath}</b></td></tr>
            </tbody>
          </Box>
        </Box>
      )}

      {/* The certifying consultant signs here. */}
      <Box sx={{ mt: 10, display: "flex", justifyContent: "flex-end" }}>
        <Box sx={{ minWidth: 260, textAlign: "left" }}>
          <Box sx={{ borderBottom: "1px solid #000", mb: 0.75, height: 48 }} />
          <Typography sx={{ fontSize: "11pt", fontWeight: 700 }}>{sheet.doctor.name}</Typography>
          {sheet.doctor.qualification && <Typography sx={{ fontSize: "10pt" }}>{sheet.doctor.qualification}</Typography>}
          {sheet.doctor.department && <Typography sx={{ fontSize: "10pt" }}>{sheet.doctor.department}</Typography>}
          {sheet.doctor.registration && <Typography sx={{ fontSize: "10pt" }}>Reg. No. {sheet.doctor.registration}</Typography>}
        </Box>
      </Box>
      <Typography sx={{ position: "absolute", bottom: "12mm", left: "20mm", right: "20mm", fontSize: "8.5pt", color: "#777" }}>
        Not valid without the doctor's signature and the hospital seal. Issued {formatDateTime(sheet.issuedAt)}.
      </Typography>
    </Box>
  );
}

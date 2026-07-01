import { useRef, useState, useEffect } from "react";
import { Box, Typography, Button, Chip, Alert, Fade } from "@mui/material";
import {
  AutoAwesomeRounded, ReplayRounded, StopRounded, PersonRounded,
  MedicalServicesRounded, MedicationRounded, TrendingUpRounded,
  FlagRounded, TaskAltRounded, InfoOutlined, HistoryRounded,
  MonitorHeartRounded, DescriptionRounded, CircleRounded,
} from "@mui/icons-material";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { typeScale } from "../../styles/typography";

const BLUE = "#3b82f6";
const BLUE_DARK = "#2563eb";
const GRAD = `linear-gradient(135deg, ${BLUE_DARK}, #6366f1)`;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type Status = "idle" | "streaming" | "done" | "error";

/**
 * AI clinical assistant sidebar. Streams a pre-consultation summary (SSE) that
 * the backend generates from the patient's own history + documents. Uses fetch
 * (not axios) so we can read the stream and still send the hospital auth header.
 */
export default function AiSummaryPanel({ patientId }: { patientId?: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === "streaming" ? "done" : s));
  };

  const generate = async () => {
    if (!patientId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setError(null);
    setStatus("streaming");

    try {
      const token = sessionStorage.getItem("hospitalAccessToken");
      const branch = sessionStorage.getItem("activeBranchId");
      const resp = await fetch(`${API_URL}/doctor/ai/patient/${patientId}/summary`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
          ...(branch ? { "X-Branch-Id": branch } : {}),
        },
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        let msg = "Couldn't start the AI summary.";
        try { const j = await resp.json(); msg = j?.message || msg; } catch { /* non-JSON */ }
        setError(msg);
        setStatus("error");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          let ev = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          let payload: any;
          try { payload = JSON.parse(dataLine); } catch { continue; }
          if (ev === "delta" && payload.text) setText((t) => t + payload.text);
          else if (ev === "error") { setError(payload.message || "AI generation failed."); setStatus("error"); }
          else if (ev === "done") setStatus("done");
        }
      }
      setStatus((s) => (s === "error" ? s : "done"));
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setError(e?.message || "AI generation failed.");
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const busy = status === "streaming";
  const hasContent = !!text;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header ─────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex", alignItems: "center", gap: 1.5, p: 1.75, mb: 2,
          borderRadius: 3, color: "#fff", background: GRAD,
          boxShadow: "0 8px 24px -10px rgba(37,99,235,0.6)",
        }}
      >
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)" }}>
          <AutoAwesomeRounded sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>AI Clinical Summary</Typography>
          <Typography sx={{ fontSize: "0.72rem", opacity: 0.85 }}>Generated from this patient's record</Typography>
        </Box>
        {busy && (
          <Button size="small" onClick={stop} startIcon={<StopRounded />}
            sx={{ textTransform: "none", color: "#fff", bgcolor: "rgba(255,255,255,0.16)", "&:hover": { bgcolor: "rgba(255,255,255,0.26)" } }}>
            Stop
          </Button>
        )}
        {!busy && hasContent && (
          <Button size="small" onClick={generate} startIcon={<ReplayRounded />}
            sx={{ textTransform: "none", color: "#fff", bgcolor: "rgba(255,255,255,0.16)", "&:hover": { bgcolor: "rgba(255,255,255,0.26)" } }}>
            Regenerate
          </Button>
        )}
      </Box>

      {/* ── Body ───────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
        {error && <Alert severity="error" variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>{error}</Alert>}

        {/* Empty / call-to-action */}
        {status === "idle" && !hasContent && (
          <Fade in>
            <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
              <Box sx={{ width: 76, height: 76, mx: "auto", mb: 2.5, borderRadius: "50%", display: "grid", placeItems: "center", background: `${BLUE}14`, boxShadow: `0 0 0 10px ${BLUE}0a` }}>
                <AutoAwesomeRounded sx={{ fontSize: 38, color: BLUE }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", mb: 0.75 }}>Get an instant briefing</Typography>
              <Typography sx={{ ...typeScale.body, color: "text.secondary", maxWidth: 300, mx: "auto", mb: 2.5 }}>
                Claude-style review of this patient's past visits, diagnoses, medications and vitals — summarized in seconds.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, flexWrap: "wrap", mb: 3 }}>
                {[
                  { icon: <HistoryRounded sx={{ fontSize: 15 }} />, label: "History" },
                  { icon: <MonitorHeartRounded sx={{ fontSize: 15 }} />, label: "Vitals" },
                  { icon: <MedicationRounded sx={{ fontSize: 15 }} />, label: "Medications" },
                  { icon: <DescriptionRounded sx={{ fontSize: 15 }} />, label: "Documents" },
                ].map((c) => (
                  <Chip key={c.label} icon={c.icon} label={c.label} size="small"
                    sx={{ bgcolor: `${BLUE}12`, color: BLUE_DARK, fontWeight: 600, "& .MuiChip-icon": { color: BLUE } }} />
                ))}
              </Box>
              <Button variant="contained" size="large" onClick={generate} disabled={!patientId} startIcon={<AutoAwesomeRounded />}
                sx={{ textTransform: "none", fontWeight: 700, px: 3, borderRadius: 2.5, background: GRAD, boxShadow: "0 8px 20px -8px rgba(37,99,235,0.7)" }}>
                Generate summary
              </Button>
            </Box>
          </Fade>
        )}

        {/* Loading (before first token) */}
        {busy && !hasContent && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 5 }}>
            <HeartbeatLoader size={80} />
            <Typography sx={{ ...typeScale.body, color: "text.secondary", mt: 1 }}>Reviewing the record…</Typography>
          </Box>
        )}

        {/* Streamed content */}
        {hasContent && (
          <Box>
            <SummaryContent text={text} />
            {busy && (
              <Box component="span" sx={{ display: "inline-block", width: 8, height: 15, ml: 0.25, borderRadius: 0.5, bgcolor: BLUE, animation: "blink 1s steps(2) infinite", "@keyframes blink": { "50%": { opacity: 0 } } }} />
            )}
          </Box>
        )}
      </Box>

      {/* ── Footer disclaimer ──────────────────────────── */}
      {(hasContent || status === "done") && (
        <Box sx={{ mt: 1.5, display: "flex", gap: 1, alignItems: "flex-start", p: 1.25, borderRadius: 2, bgcolor: "action.hover" }}>
          <InfoOutlined sx={{ fontSize: 16, color: "text.secondary", mt: "1px" }} />
          <Typography sx={{ ...typeScale.caption }}>
            AI-generated decision support — verify against the record. Not a diagnosis or treatment order.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Section-aware markdown renderer ──────────────────────────────────────────
// Maps the assistant's known headings to an icon + accent colour so the briefing
// reads like a structured clinical card rather than raw text.
const SECTION_STYLES: { match: RegExp; icon: any; color: string }[] = [
  { match: /snapshot|overview/i, icon: PersonRounded, color: "#3b82f6" },
  { match: /problem|condition|active|recurring/i, icon: MedicalServicesRounded, color: "#f59e0b" },
  { match: /medication|drug|prescription/i, icon: MedicationRounded, color: "#8b5cf6" },
  { match: /trend|change|notable/i, icon: TrendingUpRounded, color: "#14b8a6" },
  { match: /flag|allerg|red|risk|alert/i, icon: FlagRounded, color: "#ef4444" },
  { match: /suggest|review|recommend|ask|check/i, icon: TaskAltRounded, color: "#10b981" },
];
function sectionStyle(heading: string) {
  return SECTION_STYLES.find((s) => s.match.test(heading)) || { icon: CircleRounded, color: BLUE };
}

function SummaryContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let first = true;

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) { out.push(<Box key={i} sx={{ height: 4 }} />); return; }

    const h2 = line.match(/^#{1,2}\s+(.*)$/);
    if (h2) {
      const label = h2[1].replace(/\*/g, "").replace(/:$/, "");
      const { icon: Icon, color } = sectionStyle(label);
      out.push(
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mt: first ? 0 : 2, mb: 1 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: `${color}1f`, color, flexShrink: 0 }}>
            <Icon sx={{ fontSize: 15 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: 0.4, textTransform: "uppercase", color }}>
            {label}
          </Typography>
        </Box>,
      );
      first = false;
      return;
    }

    const h3 = line.match(/^#{3,}\s+(.*)$/);
    if (h3) {
      out.push(<Typography key={i} sx={{ ...typeScale.bodyStrong, mt: 1 }}>{inline(h3[1])}</Typography>);
      return;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      out.push(
        <Box key={i} sx={{ display: "flex", gap: 1, mb: 0.5, pl: 0.5 }}>
          <Box sx={{ mt: "7px", width: 5, height: 5, borderRadius: "50%", bgcolor: BLUE, flexShrink: 0 }} />
          <Typography sx={{ ...typeScale.body, lineHeight: 1.55 }}>{inline(bullet[1])}</Typography>
        </Box>,
      );
      return;
    }

    out.push(<Typography key={i} sx={{ ...typeScale.body, lineHeight: 1.55, mb: 0.5 }}>{inline(line)}</Typography>);
  });

  return <Box>{out}</Box>;
}

// Render **bold** spans inline.
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <Box key={i} component="strong" sx={{ fontWeight: 700, color: "text.primary" }}>{p.slice(2, -2)}</Box>
      : <span key={i}>{p}</span>,
  );
}

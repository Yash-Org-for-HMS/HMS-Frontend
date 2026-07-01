import { useRef, useState, useEffect } from "react";
import { Box, Typography, Button, Chip, Alert } from "@mui/material";
import { AutoAwesomeRounded, ReplayRounded, StopRounded } from "@mui/icons-material";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { typeScale } from "../../styles/typography";

const DOCTOR_BLUE = "#3b82f6";
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

  // Cancel any in-flight request if the panel unmounts.
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
        try {
          const j = await resp.json();
          msg = j?.message || msg;
        } catch { /* non-JSON error body */ }
        setError(msg);
        setStatus("error");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Parse the SSE frame stream: frames separated by a blank line, each with
      // an `event:` line and a `data:` JSON line.
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
      if (controller.signal.aborted) return; // user cancelled / unmounted
      setError(e?.message || "AI generation failed.");
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${DOCTOR_BLUE}1a`, color: DOCTOR_BLUE }}>
          <AutoAwesomeRounded sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...typeScale.cardTitle }}>AI Clinical Summary</Typography>
          <Typography sx={{ ...typeScale.caption }}>From this patient's history &amp; records</Typography>
        </Box>
        {status === "streaming" ? (
          <Button size="small" onClick={stop} startIcon={<StopRounded />} sx={{ textTransform: "none", color: "text.secondary" }}>Stop</Button>
        ) : (
          <Button
            size="small"
            variant={status === "idle" ? "contained" : "outlined"}
            onClick={generate}
            disabled={!patientId}
            startIcon={status === "idle" ? <AutoAwesomeRounded /> : <ReplayRounded />}
            sx={status === "idle"
              ? { textTransform: "none", background: `linear-gradient(135deg, #2563eb, ${DOCTOR_BLUE})` }
              : { textTransform: "none", borderColor: "divider", color: "text.primary" }}
          >
            {status === "idle" ? "Generate" : "Regenerate"}
          </Button>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
        {status === "idle" && !text && (
          <Box sx={{ textAlign: "center", color: "text.secondary", py: 4, px: 2 }}>
            <AutoAwesomeRounded sx={{ fontSize: 34, color: `${DOCTOR_BLUE}66`, mb: 1 }} />
            <Typography sx={{ ...typeScale.body }}>
              Generate an AI briefing that reviews this patient's past visits, diagnoses, medications and vitals.
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        {status === "streaming" && !text && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <HeartbeatLoader size={72} label="Reviewing the record…" />
          </Box>
        )}

        {text && <Markdownish text={text} />}

        {status === "streaming" && text && (
          <Box component="span" sx={{ display: "inline-block", width: 8, height: 16, ml: 0.25, bgcolor: DOCTOR_BLUE, animation: "blink 1s steps(2) infinite", "@keyframes blink": { "50%": { opacity: 0 } } }} />
        )}
      </Box>

      {(text || status === "done") && (
        <Typography sx={{ ...typeScale.caption, mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider", display: "block" }}>
          AI-generated decision support — verify against the record. Not a diagnosis.
        </Typography>
      )}
    </Box>
  );
}

// Minimal Markdown renderer (headings, bullets, bold) — avoids a new dependency
// for the small, well-known shape the assistant emits.
function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <Box>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <Box key={i} sx={{ height: 6 }} />;
        if (line.startsWith("### ")) {
          return <Typography key={i} sx={{ ...typeScale.bodyStrong, mt: 1.25 }}>{inline(line.slice(4))}</Typography>;
        }
        if (line.startsWith("## ")) {
          return <Typography key={i} sx={{ ...typeScale.sectionLabel, mt: 1.5, mb: 0.25, color: DOCTOR_BLUE }}>{inline(line.slice(3))}</Typography>;
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) {
          return (
            <Box key={i} sx={{ display: "flex", gap: 1, mb: 0.4 }}>
              <Box sx={{ color: DOCTOR_BLUE, lineHeight: 1.5 }}>•</Box>
              <Typography sx={{ ...typeScale.body }}>{inline(bullet[1])}</Typography>
            </Box>
          );
        }
        return <Typography key={i} sx={{ ...typeScale.body, mb: 0.4 }}>{inline(line)}</Typography>;
      })}
    </Box>
  );
}

// Render **bold** spans inline.
function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <Box key={i} component="strong" sx={{ fontWeight: 700 }}>{p.slice(2, -2)}</Box>
      : <span key={i}>{p}</span>,
  );
}

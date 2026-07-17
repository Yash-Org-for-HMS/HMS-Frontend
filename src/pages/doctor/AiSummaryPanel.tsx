import { ACCENTS } from "../../styles/accents";
import { useRef, useState, useEffect } from "react";
import { Box, Typography, Button, Chip, Alert, Fade, TextField, IconButton, Tooltip } from "@mui/material";
import {
  AutoAwesomeRounded, ReplayRounded, StopRounded, PersonRounded,
  MedicalServicesRounded, MedicationRounded, TrendingUpRounded,
  FlagRounded, TaskAltRounded, InfoOutlined, HistoryRounded,
  MonitorHeartRounded, DescriptionRounded, CircleRounded, SendRounded,
  KeyboardTabRounded,
} from "@mui/icons-material";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { typeScale } from "../../styles/typography";
import { API_URL } from "../../api/axios";

const BLUE = ACCENTS.doctor;
const BLUE_DARK = ACCENTS.doctorDark;

// Signature gradients — the whole "premium AI" look hangs off these two.
const GRAD = "linear-gradient(135deg, #3b82f6 0%, #6366f1 55%, #8b5cf6 100%)";
const GRAD_HEADER = "linear-gradient(120deg, #1e40af 0%, #4338ca 52%, #6d28d9 100%)";

const DEX_NAME = "Dr. Dex";
const DEX_TAGLINE = "AI clinical assistant";

type Status = "idle" | "streaming" | "done" | "error";
type ChatMsg = { role: "user" | "assistant"; content: string };

// Preset clinical questions — quick one-tap prompts. The doctor can also type
// their own question in the input below.
const SUGGESTED = [
  "Summarize the active problems.",
  "What medications is the patient on?",
  "Any allergy or drug-interaction risks?",
  "What's the trend in vitals / BP?",
  "What happened at the last visit?",
  "Any red flags to watch for?",
  "What should I follow up on today?",
];

const CAPABILITIES = [
  { icon: <HistoryRounded sx={{ fontSize: 15 }} />, label: "History" },
  { icon: <MonitorHeartRounded sx={{ fontSize: 15 }} />, label: "Vitals" },
  { icon: <MedicationRounded sx={{ fontSize: 15 }} />, label: "Medications" },
  { icon: <DescriptionRounded sx={{ fontSize: 15 }} />, label: "Documents" },
];

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = sessionStorage.getItem("hospitalAccessToken");
  const branch = sessionStorage.getItem("activeBranchId");
  return { Authorization: `Bearer ${token || ""}`, ...(branch ? { "X-Branch-Id": branch } : {}), ...extra };
}

/**
 * Dr. Dex's orb — a circular gradient mark. `glow` adds a soft blurred halo
 * behind it for the hero/empty state; the small variants sit beside replies.
 */
function DexOrb({ size = 40, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {glow && (
        <Box sx={{ position: "absolute", inset: -size * 0.38, borderRadius: "50%", background: GRAD, filter: "blur(18px)", opacity: 0.55 }} />
      )}
      <Box sx={{
        position: "relative", width: size, height: size, borderRadius: "50%",
        display: "grid", placeItems: "center", background: GRAD, color: "#fff",
        boxShadow: "0 6px 18px rgba(99,102,241,0.45)",
      }}>
        <AutoAwesomeRounded sx={{ fontSize: size * 0.5 }} />
      </Box>
    </Box>
  );
}

// Read our SSE stream (event: delta|done|error; frames delimited by \n\n).
async function readSse(
  resp: Response,
  h: { onDelta: (t: string) => void; onError: (m: string) => void; onDone?: () => void },
) {
  const reader = resp.body!.getReader();
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
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let p: any;
      try { p = JSON.parse(data); } catch { continue; }
      if (ev === "delta" && p.text) h.onDelta(p.text);
      else if (ev === "error") h.onError(p.message || "AI generation failed.");
      else if (ev === "done") h.onDone?.();
    }
  }
}

/**
 * Dr. Dex — AI clinical assistant: a pre-consultation summary + a grounded
 * follow-up chat, both streamed (SSE) from the backend and scoped to this
 * patient's own record. Rendered inside a slide-over on the consultation page.
 */
export default function AiSummaryPanel({ patientId, onCollapse }: { patientId?: string; onCollapse?: () => void }) {
  // Summary state
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const chatAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); chatAbortRef.current?.abort(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, text]);

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
    setText(""); setError(null); setStatus("streaming");
    try {
      const resp = await fetch(`${API_URL}/doctor/ai/patient/${patientId}/summary`, {
        headers: authHeaders(), signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        let msg = "Couldn't start the AI summary.";
        try { const j = await resp.json(); msg = j?.message || msg; } catch { /* non-JSON */ }
        setError(msg); setStatus("error"); return;
      }
      await readSse(resp, {
        onDelta: (t) => setText((prev) => prev + t),
        onError: (m) => { setError(m); setStatus("error"); },
        onDone: () => setStatus("done"),
      });
      setStatus((s) => (s === "error" ? s : "done"));
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      setError((e instanceof Error && e.message) || "AI generation failed."); setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const sendChat = async (raw: string) => {
    const q = raw.trim();
    if (!q || chatBusy || !patientId) return;
    const history = [...messages, { role: "user", content: q } as ChatMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setChatError(null); setChatBusy(true);
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const resp = await fetch(`${API_URL}/doctor/ai/patient/${patientId}/chat`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        let msg = "Couldn't get an answer.";
        try { const j = await resp.json(); msg = j?.message || msg; } catch { /* non-JSON */ }
        setChatError(msg);
        setMessages((m) => m.filter((x, i) => !(i === m.length - 1 && x.role === "assistant" && !x.content)));
        return;
      }
      await readSse(resp, {
        onDelta: (t) => setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + t };
          return c;
        }),
        onError: (msg) => setChatError(msg),
      });
    } catch (e: unknown) {
      if (!controller.signal.aborted) setChatError((e instanceof Error && e.message) || "Couldn't get an answer.");
    } finally {
      setChatBusy(false);
      chatAbortRef.current = null;
      // Drop an empty assistant placeholder left behind by an error/abort.
      setMessages((m) => m.filter((x, i) => !(i === m.length - 1 && x.role === "assistant" && !x.content)));
    }
  };

  const submitInput = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || chatBusy || !patientId) return;
    setInput("");
    sendChat(q);
  };

  const busy = status === "streaming";
  const hasContent = !!text;
  const isEmpty = status === "idle" && !hasContent && messages.length === 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
      {/* ── Gradient header banner ─────────────────────── */}
      <Box sx={{ background: GRAD_HEADER, color: "#fff", px: 2, py: 1.75, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ position: "relative", width: 38, height: 38, flexShrink: 0 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center",
            bgcolor: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)",
          }}>
            <AutoAwesomeRounded sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%", bgcolor: "#22c55e", border: "2px solid #4338ca" }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.15 }}>{DEX_NAME}</Typography>
          <Typography sx={{ fontSize: "0.72rem", opacity: 0.85 }}>{DEX_TAGLINE}</Typography>
        </Box>
        {busy && (
          <Tooltip title="Stop">
            <IconButton size="small" onClick={stop} aria-label="Stop" sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.15)", "&:hover": { bgcolor: "rgba(255,255,255,0.28)" } }}>
              <StopRounded sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
        {!busy && hasContent && (
          <Tooltip title="Regenerate briefing">
            <IconButton size="small" onClick={generate} aria-label="Regenerate" sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.15)", "&:hover": { bgcolor: "rgba(255,255,255,0.28)" } }}>
              <ReplayRounded sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
        )}
        {onCollapse && (
          <Tooltip title="Close">
            <IconButton size="small" onClick={onCollapse} aria-label="Close Dr. Dex" sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.15)", "&:hover": { bgcolor: "rgba(255,255,255,0.28)" } }}>
              <KeyboardTabRounded sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* ── Scrollable content: summary + chat ─────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
        {error && <Alert severity="error" variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>{error}</Alert>}

        {isEmpty && (
          <Fade in>
            <Box sx={{ textAlign: "center", px: 1, minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <DexOrb size={74} glow />
              <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mt: 3, mb: 0.75 }}>Hi, I'm {DEX_NAME}</Typography>
              <Typography sx={{ ...typeScale.body, color: "text.secondary", maxWidth: 320, mb: 3 }}>
                Your clinical co-pilot. I'll review this patient's history, vitals, medications and documents and brief you in seconds — or answer any question you have.
              </Typography>
              <Button
                variant="contained" size="large" onClick={generate} disabled={!patientId} startIcon={<AutoAwesomeRounded />}
                sx={{
                  textTransform: "none", fontWeight: 700, fontSize: "0.95rem", px: 3.5, py: 1.15, borderRadius: 99,
                  background: GRAD, boxShadow: "0 10px 24px rgba(99,102,241,0.4)",
                  "&:hover": { background: GRAD, filter: "brightness(1.06)", boxShadow: "0 12px 28px rgba(99,102,241,0.5)" },
                  "&.Mui-disabled": { background: "action.disabledBackground", color: "action.disabled", boxShadow: "none" },
                }}
              >
                Generate briefing
              </Button>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, flexWrap: "wrap", mt: 3, maxWidth: 320 }}>
                {CAPABILITIES.map((c) => (
                  <Chip key={c.label} icon={c.icon} label={c.label} size="small"
                    sx={{ bgcolor: `${BLUE}12`, color: BLUE_DARK, fontWeight: 600, "& .MuiChip-icon": { color: BLUE } }} />
                ))}
              </Box>
            </Box>
          </Fade>
        )}

        {busy && !hasContent && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%" }}>
            <DexOrb size={56} glow />
            <HeartbeatLoader size={60} />
            <Typography sx={{ ...typeScale.body, color: "text.secondary", mt: 1 }}>{DEX_NAME} is reviewing the record…</Typography>
          </Box>
        )}

        {hasContent && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <DexOrb size={28} />
            <Box sx={{ flex: 1, minWidth: 0, p: 1.5, borderRadius: 3, borderTopLeftRadius: 6, bgcolor: "action.hover" }}>
              <SummaryContent text={text} />
              {busy && <StreamCursor />}
            </Box>
          </Box>
        )}

        {/* Chat transcript */}
        {messages.length > 0 && (
          <Box sx={{ mt: hasContent ? 2.5 : 0 }}>
            {messages.map((m, i) => (
              <Box key={i} sx={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                {m.role === "assistant" && <DexOrb size={28} />}
                <Box sx={{
                  maxWidth: "82%", px: 1.5, py: 1.15, borderRadius: 3,
                  ...(m.role === "user"
                    ? { background: GRAD, color: "#fff", borderBottomRightRadius: 6, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }
                    : { bgcolor: "action.hover", color: "text.primary", borderTopLeftRadius: 6 }),
                }}>
                  {m.role === "user"
                    ? <Typography sx={{ ...typeScale.body, color: "#fff", whiteSpace: "pre-wrap" }}>{m.content}</Typography>
                    : (m.content
                        ? <SummaryContent text={m.content} chat />
                        : <Box sx={{ py: 0.5 }}><HeartbeatLoader size={30} /></Box>)}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {chatError && <Alert severity="error" variant="outlined" sx={{ mt: 1, borderRadius: 2 }}>{chatError}</Alert>}
        <div ref={bottomRef} />
      </Box>

      {/* ── Quick prompts + free-form question ─────────── */}
      <Box sx={{ px: 2, pt: 1 }}>
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, "&::-webkit-scrollbar": { height: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 4 } }}>
          {SUGGESTED.map((q) => (
            <Chip
              key={q} label={q} size="small" clickable
              onClick={() => sendChat(q)}
              disabled={chatBusy || !patientId}
              sx={{ flexShrink: 0, border: "1px solid", borderColor: `${BLUE}33`, color: BLUE_DARK, bgcolor: `${BLUE}0d`, fontWeight: 600, "&:hover": { bgcolor: `${BLUE}1a`, borderColor: `${BLUE}66` } }}
            />
          ))}
        </Box>
        <Box component="form" onSubmit={submitInput} sx={{ display: "flex", alignItems: "flex-end", gap: 0.75 }}>
          <TextField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInput(); }
            }}
            placeholder={patientId ? `Ask ${DEX_NAME} anything…` : "Select a patient first"}
            disabled={chatBusy || !patientId}
            size="small"
            fullWidth
            multiline
            maxRows={4}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "background.default", ...typeScale.body, "& fieldset": { borderColor: "divider" }, "&.Mui-focused fieldset": { borderColor: BLUE } } }}
          />
          <IconButton
            type="submit"
            disabled={chatBusy || !patientId || !input.trim()}
            aria-label="Send"
            sx={{ background: GRAD, color: "#fff", borderRadius: "50%", width: 42, height: 42, flexShrink: 0, boxShadow: "0 4px 12px rgba(99,102,241,0.35)", "&:hover": { background: GRAD, filter: "brightness(1.06)" }, "&.Mui-disabled": { background: "action.disabledBackground", color: "action.disabled", boxShadow: "none" } }}
          >
            <SendRounded sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* ── Disclaimer ─────────────────────────────────── */}
        <Box sx={{ mt: 1.25, mb: 2, display: "flex", gap: 1, alignItems: "flex-start", p: 1, borderRadius: 2, bgcolor: "action.hover" }}>
          <InfoOutlined sx={{ fontSize: 15, color: "text.secondary", mt: "1px" }} />
          <Typography sx={{ ...typeScale.caption }}>
            {DEX_NAME} is AI decision support — verify against the record. Not a diagnosis or treatment order.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function StreamCursor() {
  return <Box component="span" sx={{ display: "inline-block", width: 8, height: 15, ml: 0.25, borderRadius: 0.5, bgcolor: BLUE, animation: "blink 1s steps(2) infinite", "@keyframes blink": { "50%": { opacity: 0 } } }} />;
}

// ── Section-aware markdown renderer ──────────────────────────────────────────
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

function SummaryContent({ text, chat = false }: { text: string; chat?: boolean }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let first = true;

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) { out.push(<Box key={i} sx={{ height: 4 }} />); return; }

    const h2 = line.match(/^#{1,2}\s+(.*)$/);
    if (h2 && !chat) {
      const label = h2[1].replace(/\*/g, "").replace(/:$/, "");
      const { icon: Icon, color } = sectionStyle(label);
      out.push(
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mt: first ? 0 : 2, mb: 1 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: `${color}1f`, color, flexShrink: 0 }}>
            <Icon sx={{ fontSize: 15 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: 0.4, textTransform: "uppercase", color }}>{label}</Typography>
        </Box>,
      );
      first = false;
      return;
    }

    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { out.push(<Typography key={i} sx={{ ...typeScale.bodyStrong, mt: 1 }}>{inline(h[1])}</Typography>); return; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      out.push(
        <Box key={i} sx={{ display: "flex", gap: 1, mb: 0.5, pl: 0.5 }}>
          <Box sx={{ mt: "7px", width: 5, height: 5, borderRadius: "50%", bgcolor: chat ? "text.disabled" : BLUE, flexShrink: 0 }} />
          <Typography sx={{ ...typeScale.body, lineHeight: 1.55 }}>{inline(bullet[1])}</Typography>
        </Box>,
      );
      return;
    }

    out.push(<Typography key={i} sx={{ ...typeScale.body, lineHeight: 1.55, mb: 0.5 }}>{inline(line)}</Typography>);
  });

  return <Box>{out}</Box>;
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <Box key={i} component="strong" sx={{ fontWeight: 700, color: "inherit" }}>{p.slice(2, -2)}</Box>
      : <span key={i}>{p}</span>,
  );
}

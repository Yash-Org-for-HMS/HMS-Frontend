import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Button, Avatar, Chip, Grid,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, ArrowForwardRounded, SyncRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import VitalsModal from "../reception/VitalsModal";

const NURSE_PURPLE = "#a78bfa";
const NURSE_PURPLE_DARK = "#7c3aed";

export default function NurseVitalsStation() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vitalsRecorded, setVitalsRecorded] = useState<Set<string>>(new Set());
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean; token: any }>({ open: false, token: null });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/reception/queue");
      const tokenList = res.data.data;
      setTokens(tokenList);

      const apptIds = tokenList.map((t: any) => t.appointmentId).filter(Boolean);
      const vitalsChecks = await Promise.allSettled(
        apptIds.map((id: string) => axiosInstance.get(`/reception/appointments/${id}/vitals`))
      );
      const recorded = new Set<string>();
      vitalsChecks.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.data.data) {
          recorded.add(apptIds[i]);
        }
      });
      setVitalsRecorded(recorded);
    } catch {
      setError("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Pending = active queue patients without vitals
  const pending = tokens.filter(
    t => t.appointmentId &&
      !vitalsRecorded.has(t.appointmentId) &&
      !["COMPLETED", "CANCELLED"].includes(t.statusCode)
  );
  const done = tokens.filter(t => t.appointmentId && vitalsRecorded.has(t.appointmentId));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: 1.5,
                background: `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <MonitorHeartRounded sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800 }}>
              Vitals Station
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", ml: 0.5 }}>
            Quick vitals recording workspace — one patient at a time
          </Typography>
        </Box>
        <Button
          variant="outlined" startIcon={<SyncRounded />} onClick={fetchQueue}
          sx={{ color: NURSE_PURPLE, borderColor: `rgba(167,139,250,0.4)`, textTransform: "none", fontWeight: 600, "&:hover": { borderColor: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.06)" } }}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={4}>
        {/* Left: Pending Vitals */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Needs Vitals
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {pending.length} patient{pending.length !== 1 ? "s" : ""} waiting
                </Typography>
              </Box>
              <Chip
                label={`${pending.length} Pending`}
                sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700 }}
              />
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress sx={{ color: NURSE_PURPLE }} />
              </Box>
            ) : pending.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                <CheckCircleRounded sx={{ fontSize: 56, color: "#10b981", opacity: 0.5, mb: 1.5 }} />
                <Typography variant="h6" sx={{ color: "#10b981", fontWeight: 700 }}>All done!</Typography>
                <Typography variant="body2">All patients have their vitals recorded 🎉</Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {pending.map((token, index) => (
                  <Box
                    key={token.queueTokenId}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2,
                      p: 2, borderRadius: 2.5,
                      border: "1px solid",
                      borderColor: index === 0 ? `rgba(167,139,250,0.4)` : "divider",
                      bgcolor: index === 0 ? `rgba(167,139,250,0.05)` : "background.default",
                      transition: "all 0.15s ease",
                      "&:hover": { borderColor: `rgba(167,139,250,0.4)`, bgcolor: `rgba(167,139,250,0.04)` },
                    }}
                  >
                    {/* Priority indicator */}
                    <Box sx={{ position: "relative" }}>
                      <Avatar
                        sx={{
                          width: 44, height: 44, fontWeight: 800,
                          background: index === 0
                            ? `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`
                            : "rgba(100,116,139,0.15)",
                          color: index === 0 ? "#fff" : "text.secondary",
                        }}
                      >
                        {token.displayNumber}
                      </Avatar>
                      {index === 0 && (
                        <Box
                          sx={{
                            position: "absolute", top: -4, right: -4,
                            width: 14, height: 14, borderRadius: "50%",
                            bgcolor: "#f59e0b", border: "2px solid",
                            borderColor: "background.paper",
                          }}
                        />
                      )}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
                          {token.patientName}
                        </Typography>
                        {index === 0 && (
                          <Chip label="Next" size="small" sx={{ bgcolor: `rgba(167,139,250,0.15)`, color: NURSE_PURPLE, fontWeight: 700, fontSize: "0.65rem", height: 18 }} />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                        {token.doctorName}
                      </Typography>
                    </Box>

                    <Chip
                      label={token.statusLabel} size="small"
                      sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}44`, fontWeight: 600, fontSize: "0.68rem" }}
                    />

                    <Button
                      size="small"
                      variant="contained"
                      endIcon={<ArrowForwardRounded />}
                      onClick={() => setVitalsDialog({ open: true, token })}
                      sx={{
                        background: index === 0
                          ? `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`
                          : "rgba(167,139,250,0.15)",
                        color: index === 0 ? "#fff" : NURSE_PURPLE,
                        textTransform: "none", fontWeight: 600, flexShrink: 0,
                        boxShadow: index === 0 ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
                        "&:hover": {
                          background: index === 0
                            ? `linear-gradient(135deg, #6d28d9, ${NURSE_PURPLE_DARK})`
                            : `rgba(167,139,250,0.25)`,
                        },
                      }}
                    >
                      {index === 0 ? "Record" : "Record"}
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right: Completed */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                Vitals Done
              </Typography>
              <Chip
                label={`${done.length} Done`}
                sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 700 }}
              />
            </Box>

            {done.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <MonitorHeartRounded sx={{ fontSize: 44, color: NURSE_PURPLE, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No vitals recorded yet
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {done.map(token => (
                  <Box
                    key={token.queueTokenId}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      p: 1.5, borderRadius: 2,
                      bgcolor: "rgba(16,185,129,0.05)",
                      border: "1px solid rgba(16,185,129,0.15)",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" },
                    }}
                    onClick={() => setVitalsDialog({ open: true, token })}
                  >
                    <Avatar sx={{ width: 34, height: 34, bgcolor: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.78rem", fontWeight: 800 }}>
                      {token.displayNumber}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>{token.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }} noWrap>{token.doctorName}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <CheckCircleRounded sx={{ color: "#10b981", fontSize: 18 }} />
                      <Typography variant="caption" sx={{ color: "#10b981", fontWeight: 600, fontSize: "0.7rem" }}>Update</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Vitals Modal */}
      {vitalsDialog.token && (
        <VitalsModal
          open={vitalsDialog.open}
          onClose={() => setVitalsDialog({ open: false, token: null })}
          appointmentId={vitalsDialog.token.appointmentId}
          patientId={vitalsDialog.token.patientId}
          patientName={vitalsDialog.token.patientName}
          onSaved={() => {
            setVitalsRecorded(prev => new Set([...prev, vitalsDialog.token.appointmentId]));
          }}
        />
      )}
    </Box>
  );
}

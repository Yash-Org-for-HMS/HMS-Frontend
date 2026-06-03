import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from "@mui/material";
import { NotificationsRounded, EmailRounded, SmsRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function NotificationsLog() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axiosInstance.get("/reception/notifications?limit=100");
      setNotifications(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <NotificationsRounded sx={{ color: "#8b5cf6", fontSize: 32 }} />
          Notifications Log
        </Typography>
        <Typography variant="body1" sx={{ color: "#94a3b8" }}>
          History of all simulated SMS and Email notifications sent to patients.
        </Typography>
      </Box>

      <Paper sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: "#0f172a", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Channel</TableCell>
                <TableCell sx={{ bgcolor: "#0f172a", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Title</TableCell>
                <TableCell sx={{ bgcolor: "#0f172a", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Message</TableCell>
                <TableCell sx={{ bgcolor: "#0f172a", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Status</TableCell>
                <TableCell sx={{ bgcolor: "#0f172a", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "right" }}>Sent At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <CircularProgress sx={{ color: "#8b5cf6" }} />
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, borderBottom: "none", color: "#94a3b8" }}>
                    No notifications sent yet.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notif) => (
                  <TableRow key={notif.notificationId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Chip
                        icon={notif.channel === "SMS" ? <SmsRounded fontSize="small" /> : <EmailRounded fontSize="small" />}
                        label={notif.channel}
                        size="small"
                        sx={{
                          bgcolor: notif.channel === "SMS" ? "rgba(56, 189, 248, 0.15)" : "rgba(244, 63, 94, 0.15)",
                          color: notif.channel === "SMS" ? "#38bdf8" : "#f43f5e",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontWeight: 500 }}>
                      {notif.title}
                    </TableCell>
                    <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {notif.message}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Chip
                        icon={<CheckCircleRounded fontSize="small" />}
                        label={notif.status}
                        size="small"
                        sx={{ bgcolor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {notif.sentAt ? new Date(notif.sentAt).toLocaleString() : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

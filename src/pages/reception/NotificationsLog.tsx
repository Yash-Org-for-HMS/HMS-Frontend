import { useQuery } from "@tanstack/react-query";
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
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";

export default function NotificationsLog() {
  const { data: notifications = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["reception-notifications"],
    queryFn: async () => (await axiosInstance.get("/reception/notifications?limit=100")).data.data,
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <NotificationsRounded sx={{ color: "#8b5cf6", fontSize: 32 }} />
          Notifications Log
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          History of all simulated SMS and Email notifications sent to patients.
        </Typography>
      </Box>

      <Paper sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Channel</TableCell>
                <TableCell sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Title</TableCell>
                <TableCell sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Message</TableCell>
                <TableCell sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
                <TableCell sx={{ bgcolor: "background.paper", color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider", textAlign: "right" }}>Sent At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <CircularProgress sx={{ color: "#8b5cf6" }} />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, borderBottom: "none" }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle="No notifications sent yet." size={130} />
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notif) => (
                  <TableRow key={notif.notificationId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider", fontWeight: 500 }}>
                      {notif.title}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {notif.message}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip
                        icon={<CheckCircleRounded fontSize="small" />}
                        label={notif.status}
                        size="small"
                        sx={{ bgcolor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
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

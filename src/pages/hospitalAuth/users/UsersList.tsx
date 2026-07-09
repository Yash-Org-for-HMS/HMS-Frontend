import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  Alert,
  Avatar,
  Divider,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  BlockRounded,
  CheckCircleRounded,
  KeyRounded,
  Visibility,
  VisibilityOff,
  ContentCopyRounded,
  LockResetRounded,
  PersonRounded,
  InfoOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import PageHeader from "../../../components/layout/PageHeader";
import { TableRowsSkeleton } from "../../../components/TableRowsSkeleton";
import { useTableSort } from "../../../components/table/useTableSort";
import SortableHeadCell from "../../../components/table/SortableHeadCell";
import HeartbeatLoader from "../../../components/HeartbeatLoader";

// Match the file's existing sentence-case header look (override SortableHeadCell's default uppercase/bold style).
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 400, fontSize: "0.875rem", py: undefined };

import type { StaffUser } from "../../../types";

interface User extends StaffUser {
  employeeCode: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  role?: { roleName: string };
  department?: { departmentName: string };
  branch?: { branchName: string };
}

// ── Reset Password Dialog ───────────────────────────────────────────────────
interface ResetPasswordDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: (newPassword: string) => void;
}

function ResetPasswordDialog({ open, user, onClose, onSuccess }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [useDefault, setUseDefault] = useState(false);

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setUseDefault(false);
    onClose();
  };

  const handleReset = async () => {
    if (!useDefault) {
      if (!newPassword || newPassword.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post(`/hospital/users/${user?.userId}/reset-password`, {
        newPassword: useDefault ? undefined : newPassword,
      });
      const finalPassword = res.data.temporaryPassword;
      onSuccess(finalPassword);
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          border: "1px solid rgba(234, 179, 8, 0.2)",
          borderRadius: 3,
          backgroundImage: "none",
          overflow: "hidden",
        },
      }}
    >
      <Box sx={{ height: 4, background: "linear-gradient(90deg, #f59e0b, #eab308)" }} />
      <DialogContent sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "rgba(234, 179, 8, 0.1)",
              border: "2px solid rgba(234, 179, 8, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockResetRounded sx={{ color: "#fbbf24", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
              Reset Password
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              For:{" "}
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </Box>
              {" · "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                {user?.email}
              </Box>
            </Typography>
          </Box>
        </Box>
{/* Default password option */}
        <Box
          onClick={() => setUseDefault(!useDefault)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 2,
            mb: 3,
            borderRadius: 2,
            bgcolor: useDefault ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${useDefault ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.08)"}`,
            cursor: "pointer",
            transition: "all 0.2s ease",
            "&:hover": { bgcolor: "rgba(234,179,8,0.05)" },
          }}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: `2px solid ${useDefault ? "#fbbf24" : "#334155"}`,
              bgcolor: useDefault ? "#fbbf24" : "transparent",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {useDefault && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "background.paper" }} />}
          </Box>
          <Box>
            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
              Generate a temporary password
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              A secure one-time password will be generated and shown to you next.
            </Typography>
          </Box>
        </Box>

        {!useDefault && (
          <>
            <Divider sx={{ borderColor: "divider", mb: 3 }}>
              <Typography variant="caption" sx={{ color: "#334155", px: 1 }}>
                or set custom password
              </Typography>
            </Divider>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="New Password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); toast.error(""); }}
                placeholder="Min 6 characters"
                InputLabelProps={{ style: { color: "text.secondary" } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowNew(!showNew)} edge="end" sx={{ color: "text.secondary" }}>
                        {showNew ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": { borderColor: "divider" },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#fbbf24" },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Confirm New Password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); toast.error(""); }}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" sx={{ color: "text.secondary" }}>
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "text.primary",
                    "& fieldset": {
                      borderColor:
                        confirmPassword && confirmPassword !== newPassword
                          ? "rgba(239,68,68,0.5)"
                          : "rgba(255,255,255,0.1)",
                    },
                    "&:hover fieldset": { borderColor: "divider" },
                    "&.Mui-focused fieldset": { borderColor: "#fbbf24" },
                  },
                }}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <Typography variant="caption" sx={{ color: "#f87171" }}>
                  Passwords do not match
                </Typography>
              )}
            </Box>
          </>
        )}

        {/* Info banner */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: "rgba(6,182,212,0.04)",
            border: "1px solid rgba(6,182,212,0.12)",
            mb: 3,
          }}
        >
          <InfoOutlined sx={{ color: "#06b6d4", fontSize: 16, mt: 0.1, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
            The staff member will be required to change this password on their next login.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleClose}
            sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleReset}
            disabled={loading}
            startIcon={loading ? <HeartbeatLoader size={22} /> : <LockResetRounded />}
            sx={{
              bgcolor: "#d97706",
              "&:hover": { bgcolor: "#b45309" },
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Credentials Success Dialog (after reset) ────────────────────────────────
interface CredentialSuccessProps {
  open: boolean;
  user: User | null;
  newPassword: string;
  onClose: () => void;
}

function CredentialSuccessDialog({ open, user, newPassword, onClose }: CredentialSuccessProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(
      `Login: ${user?.email}\nPassword: ${newPassword}\n\nNote: You will be asked to change your password on next login.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 3,
          backgroundImage: "none",
        },
      }}
    >
      <Box sx={{ height: 4, bgcolor: "#10b981" }} />
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <CheckCircleRounded sx={{ color: "#10b981", fontSize: 40, mb: 1 }} />
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
            Password Reset!
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Share these new credentials with {user?.firstName}
          </Typography>
        </Box>

        <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid", borderColor: "divider", mb: 2 }}>
          <Typography variant="caption" sx={{ color: "#475569" }}>Email</Typography>
          <Typography sx={{ color: "text.primary", fontFamily: "monospace", fontSize: "0.875rem", mb: 1 }}>{user?.email}</Typography>
          <Typography variant="caption" sx={{ color: "#475569" }}>New Password</Typography>
          <Typography sx={{ color: "#fbbf24", fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700 }}>{newPassword}</Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={copied ? <CheckCircleRounded /> : <ContentCopyRounded />}
            onClick={copy}
            sx={{ color: copied ? "#10b981" : "#64748b", borderColor: "divider", textTransform: "none" }}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button fullWidth variant="contained" onClick={onClose} sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, textTransform: "none" }}>
            Done
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Main UsersList ──────────────────────────────────────────────────────────
export default function UsersList() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  // Reset password dialog
  const [resetDialog, setResetDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; user: User | null; password: string }>({
    open: false,
    user: null,
    password: "",
  });

  const { data: users = [], isLoading, isError, error, refetch } = useQuery<User[]>({
    queryKey: ["hospital-users-list"],
    queryFn: async () => (await axiosInstance.get("/hospital/users")).data.data,
  });

  const { sorted, orderBy, order, onSort } = useTableSort(users, {
    name: (u) => `${u.firstName} ${u.lastName}`.trim(),
    role: (u) => u.role?.roleName ?? null,
    department: (u) => u.department?.departmentName ?? null,
    branch: (u) => u.branch?.branchName ?? null,
    status: (u) => (u.isActive ? "Active" : "Inactive"),
  });

  const handleToggleStatus = async (user: User) => {
    const activating = !user.isActive;
    const ok = await confirm({
      title: activating ? "Activate user" : "Deactivate user",
      message: activating
        ? `Reactivate ${user.firstName} ${user.lastName}? They will be able to log in again.`
        : `Deactivate ${user.firstName} ${user.lastName}? They will no longer be able to log in.`,
      confirmText: activating ? "Activate" : "Deactivate",
      destructive: !activating,
    });
    if (!ok) return;
    try {
      await axiosInstance.put(`/hospital/users/${user.userId}/deactivate`, { isActive: !user.isActive });
      refetch();
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to update user status");
    }
  };

  return (
    <>
      <Box>
        <PageHeader
          title="Staff & Users"
          subtitle="Manage your hospital's staff, roles, and assignments."
          actions={
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => navigate("/hospital/users/new")}
              sx={{
                bgcolor: "#6366f1",
                "&:hover": { bgcolor: "#4f46e5" },
                textTransform: "none",
                fontWeight: 600,
                px: 3,
              }}
            >
              Add Staff
            </Button>
          }
        />

        <TableContainer
          component={Paper}
          sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "calc(100vh - 300px)" }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Staff Member" sortKey="name" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Role" sortKey="role" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Department" sortKey="department" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Branch" sortKey="branch" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle="No staff members found." size={120} />
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((user) => (
                  <TableRow key={user.userId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            bgcolor: "#6366f1",
                            fontSize: "0.875rem",
                            fontWeight: 700,
                          }}
                        >
                          {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>
                            {user.firstName} {user.lastName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {user.email}
                            {user.employeeCode && ` · ${user.employeeCode}`}
                          </Typography>
                          {user.mustChangePassword && (
                            <Chip
                              label="Must change password"
                              size="small"
                              sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#fbbf24", height: 16, fontSize: "0.75rem", ml: 0.5 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {user.role?.roleName || "—"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {user.department?.departmentName || "—"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {user.branch?.branchName || "—"}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip
                        label={user.isActive ? "Active" : "Inactive"}
                        size="small"
                        sx={{
                          bgcolor: user.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          color: user.isActive ? "#34d399" : "#f87171",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Tooltip title="Reset Password">
                        <IconButton
                          size="small"
                          onClick={() => setResetDialog({ open: true, user })}
                          sx={{ color: "text.secondary", "&:hover": { color: "#fbbf24", bgcolor: "rgba(234,179,8,0.1)" } }}
                        >
                          <KeyRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Staff">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hospital/users/${user.userId}/edit`)}
                          sx={{ color: "text.secondary", "&:hover": { color: "#6366f1", bgcolor: "rgba(99,102,241,0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={user.isActive ? "Deactivate" : "Activate"}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(user)}
                          sx={{
                            color: "text.secondary",
                            "&:hover": {
                              color: user.isActive ? "#f87171" : "#34d399",
                              bgcolor: user.isActive ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                            },
                          }}
                        >
                          {user.isActive ? <BlockRounded fontSize="small" /> : <CheckCircleRounded fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetDialog.open}
        user={resetDialog.user}
        onClose={() => setResetDialog({ open: false, user: null })}
        onSuccess={(pwd) => {
          setSuccessDialog({ open: true, user: resetDialog.user, password: pwd });
          setResetDialog({ open: false, user: null });
          refetch();
        }}
      />

      {/* Success Credential Dialog */}
      <CredentialSuccessDialog
        open={successDialog.open}
        user={successDialog.user}
        newPassword={successDialog.password}
        onClose={() => setSuccessDialog({ open: false, user: null, password: "" })}
      />
    </>
  );
}

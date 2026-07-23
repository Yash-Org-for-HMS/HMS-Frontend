import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { canAccessPanel, homeForRole, type Panel } from "@/constants/roles";
import { Box } from "@mui/material";
import HeartbeatLoader from "./HeartbeatLoader";

// `panel` gates the wrapped routes to the panel(s) that own them, so a user of
// one panel can't render another panel's shell by URL. Omit it to require only
// authentication (unchanged behaviour). The check mirrors the backend and is
// never stricter than it: admins pass, a user always reaches their own home
// panel, and custom roles pass via the permission fallback — an unauthorized
// user is bounced to their own home rather than shown a screen that isn't theirs.
export function HospitalProtectedRoute({ panel }: { panel?: Panel } = {}) {
  const { isAuthenticated, loading, user } = useHospitalAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#0f172a",
        }}
      >
        <HeartbeatLoader size={96} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/hospital/login" state={{ from: location }} replace />;
  }

  // Panel isolation. Only enforce once we actually have the user (fail open on a
  // missing user to avoid any redirect loop — the backend still guards data).
  if (panel && user && !canAccessPanel(user.role, user.permissions, panel)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}

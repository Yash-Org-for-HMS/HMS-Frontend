import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthContext";
import { Box } from "@mui/material";
import HeartbeatLoader from "./HeartbeatLoader";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <HeartbeatLoader size={96} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // The bare address belongs to hospital staff; the super admin signs in at /login.
    if (location.pathname === "/") return <Navigate to="/hospital/login" replace />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

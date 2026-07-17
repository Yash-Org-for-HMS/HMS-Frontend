import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { Box } from "@mui/material";
import HeartbeatLoader from "./HeartbeatLoader";

export function HospitalProtectedRoute() {
  const { isAuthenticated, loading } = useHospitalAuth();
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

  return <Outlet />;
}

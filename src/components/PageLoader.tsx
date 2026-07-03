import { Box } from "@mui/material";
import HeartbeatLoader from "./HeartbeatLoader";

/**
 * The standard full-page loading state: a centred heartbeat loader. Replaces
 * the ad-hoc `<Box sx={{ … }}><HeartbeatLoader size={96} /></Box>` wrappers that
 * had drifted apart (py:4 / mt:4 / p:8 / height:80vh …) so the loader always
 * sits in the same place across the app.
 */
export default function PageLoader({ minHeight = "60vh" }: { minHeight?: number | string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight, width: "100%" }}>
      <HeartbeatLoader size={96} />
    </Box>
  );
}

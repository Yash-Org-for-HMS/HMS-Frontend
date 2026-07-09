import { Box, Button } from "@mui/material";
import { RefreshRounded } from "@mui/icons-material";
import Mascot from "./Mascot";

interface ErrorStateProps {
  /** Headline — defaults to a friendly generic. */
  title?: string;
  /** Detail line — pass the backend message here so failures aren't silent. */
  message?: string;
  /** When provided, renders a Retry button (e.g. react-query's refetch). */
  onRetry?: () => void;
}

/**
 * Standard "couldn't load / action failed" placeholder. Drop this in wherever a
 * fetch can fail so the page shows a clear, retryable error instead of a blank
 * screen. Pass the backend's message so the real reason surfaces to the user.
 */
export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this right now. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6 }}>
      <Mascot pose="oops" title={title} subtitle={message} />
      {onRetry && (
        <Button variant="outlined" startIcon={<RefreshRounded />} onClick={onRetry} sx={{ mt: 2 }}>
          Retry
        </Button>
      )}
    </Box>
  );
}

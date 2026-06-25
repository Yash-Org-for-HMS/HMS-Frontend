import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import { ErrorOutlineRounded, RefreshRounded, ReplayRounded } from "@mui/icons-material";

interface Props {
  children: ReactNode;
  /**
   * When this value changes, the boundary clears any caught error and re-renders
   * its children. Wire it to the route (location.pathname) so navigating away
   * from a broken page recovers without a full reload.
   */
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  lastResetKey: string | number | undefined;
}

/**
 * Top-level error boundary. React unmounts the whole tree when a render throws
 * and nothing catches it — that's the "blank white screen". This contains the
 * failure to a friendly panel with recover/reload actions, so a bug in one page
 * never takes down the entire app. Error boundaries must be class components.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, lastResetKey: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // Reset the error when the resetKey changes (e.g. the user navigated to a new
  // route), without needing a manual click.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.lastResetKey) {
      if (state.hasError) {
        return { hasError: false, error: null, lastResetKey: props.resetKey };
      }
      return { lastResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the full error + component stack for debugging. A real error-
    // reporting service (Sentry etc.) would hook in here.
    console.error("Uncaught error caught by ErrorBoundary:", error, info.componentStack);
  }

  private handleReset = () => this.setState({ hasError: false, error: null });
  private handleReload = () => window.location.reload();

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: 3,
          gap: 2,
          bgcolor: "background.default",
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            bgcolor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ErrorOutlineRounded sx={{ fontSize: 38, color: "error.main" }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Something went wrong
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 460 }}>
          This page hit an unexpected error. Your data is safe — try again, or reload the page.
          If it keeps happening, please let your administrator know.
        </Typography>

        {import.meta.env.DEV && this.state.error && (
          <Box
            component="pre"
            sx={{
              mt: 1,
              p: 2,
              maxWidth: 720,
              width: "100%",
              overflowX: "auto",
              textAlign: "left",
              bgcolor: "action.hover",
              borderRadius: 2,
              fontSize: "0.78rem",
              color: "error.main",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </Box>
        )}

        <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
          <Button variant="contained" startIcon={<ReplayRounded />} onClick={this.handleReset}>
            Try again
          </Button>
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={this.handleReload}>
            Reload page
          </Button>
        </Stack>
      </Box>
    );
  }
}

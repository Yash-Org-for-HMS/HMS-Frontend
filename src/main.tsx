import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import { theme } from "./theme";
import "./i18n";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/providers/ToastContext";
import { ConfirmProvider } from "@/providers/ConfirmContext";

// Wrap the app in an error boundary keyed to the current route, so a render
// crash shows a contained fallback (not a blank screen) and navigating to
// another page clears it automatically.
function RoutedApp() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Always reserve the vertical scrollbar's space so switching between
            short and tall pages/tabs doesn't shift centered layouts sideways. */}
        <GlobalStyles styles={{ html: { scrollbarGutter: "stable" } }} />
        <BrowserRouter>
          <ToastProvider>
            <ConfirmProvider>
              <RoutedApp />
            </ConfirmProvider>
          </ToastProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Snackbar, Alert } from "@mui/material";

type ToastSeverity = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: number;
  message: string;
  severity: ToastSeverity;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [currentToast, setCurrentToast] = useState<ToastMessage | undefined>(undefined);

  useEffect(() => {
    if (toasts.length && !currentToast) {
      setCurrentToast({ ...toasts[0] });
      setToasts((prev) => prev.slice(1));
      setOpen(true);
    } else if (toasts.length && currentToast && open) {
      setOpen(false);
    }
  }, [toasts, currentToast, open]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  const handleExited = () => {
    setCurrentToast(undefined);
  };

  const showToast = useCallback((message: string, severity: ToastSeverity) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, severity }]);
  }, []);

  const success = useCallback((msg: string) => showToast(msg, "success"), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, "error"), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, "info"), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, "warning"), [showToast]);

  // The methods are already useCallback-stable — without this, every one of
  // this provider's ~67 consumers re-rendered whenever a toast was shown,
  // since a fresh object literal was passed as the context value every render.
  const value = useMemo(() => ({ success, error, info, warning }), [success, error, info, warning]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={currentToast ? currentToast.id : undefined}
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ mb: 2, mr: 2 }}
      >
        <Alert
          onClose={handleClose}
          severity={currentToast?.severity}
          variant="filled"
          sx={{ 
            width: "100%", 
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            borderRadius: 2,
            fontWeight: 600,
            alignItems: "center"
          }}
        >
          {currentToast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

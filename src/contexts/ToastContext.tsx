import { createContext, useContext, useState, useCallback, useEffect } from "react";
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

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
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

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField,
} from "@mui/material";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface ReasonOptions {
  title?: string;
  message: string;
  label?: string;
  confirmText?: string;
}
/** Resolves to the reason typed (3+ characters), or null when cancelled. */
type AskReasonFn = (options: ReasonOptions) => Promise<string | null>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);
const ReasonContext = createContext<AskReasonFn | undefined>(undefined);

/**
 * App-wide confirmation dialog. Replaces blocking window.confirm() with a styled,
 * promise-based MUI dialog: `if (await confirm({ message })) { ... }`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = undefined;
  };

  // The same kind of dialog, asking for a reason: for actions the server only
  // allows with one recorded (covering a colleague's visit, amending a closed one).
  const [reasonOpts, setReasonOpts] = useState<ReasonOptions | null>(null);
  const [reason, setReason] = useState("");
  const reasonResolver = useRef<((value: string | null) => void) | undefined>(undefined);
  const askReason = useCallback<AskReasonFn>((opts) => {
    setReason("");
    setReasonOpts(opts);
    return new Promise<string | null>((resolve) => {
      reasonResolver.current = resolve;
    });
  }, []);
  const closeReason = (value: string | null) => {
    setReasonOpts(null);
    reasonResolver.current?.(value);
    reasonResolver.current = undefined;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      <ReasonContext.Provider value={askReason}>
        {children}
        <Dialog
          open={open}
          onClose={() => handleClose(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>{options.title || "Please confirm"}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "text.secondary" }}>{options.message}</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => handleClose(false)} color="inherit" sx={{ fontWeight: 600, borderRadius: "8px" }}>
              {options.cancelText || "Cancel"}
            </Button>
            <Button
              onClick={() => handleClose(true)}
              variant="contained"
              color={options.destructive ? "error" : "primary"}
              sx={{ fontWeight: 600, borderRadius: "8px" }}
            >
              {options.confirmText || "Confirm"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!reasonOpts}
          onClose={() => closeReason(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>{reasonOpts?.title || "Reason needed"}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "text.secondary", mb: 2 }}>{reasonOpts?.message}</DialogContentText>
            <TextField
              autoFocus fullWidth size="small" required
              label={reasonOpts?.label || "Reason"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => closeReason(null)} color="inherit" sx={{ fontWeight: 600, borderRadius: "8px" }}>
              Cancel
            </Button>
            <Button
              onClick={() => closeReason(reason.trim())}
              variant="contained"
              disabled={reason.trim().length < 3}
              sx={{ fontWeight: 600, borderRadius: "8px" }}
            >
              {reasonOpts?.confirmText || "Continue"}
            </Button>
          </DialogActions>
        </Dialog>
      </ReasonContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (ctx === undefined) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}

export function useAskReason() {
  const ctx = useContext(ReasonContext);
  if (ctx === undefined) {
    throw new Error("useAskReason must be used within a ConfirmProvider");
  }
  return ctx;
}

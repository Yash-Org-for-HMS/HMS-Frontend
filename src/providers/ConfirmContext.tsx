import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from "@mui/material";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

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

  return (
    <ConfirmContext.Provider value={confirm}>
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

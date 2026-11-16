import { useEffect, useState } from "react";
import {
  Box, Chip, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack,
} from "@mui/material";
import { CloudDoneOutlined, CloudOffRounded, SyncRounded, ErrorOutlineRounded } from "@mui/icons-material";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/providers/ToastContext";
import { getOfflineState as getState, setOfflineState, useOfflineState } from "@/offline/offlineState";
import { API_URL } from "@/api/axios";
import { pageWorksOffline } from "@/offline/offlineScope";
import { countSaves, discardSave, mySaves, retrySave, sendWaiting, type QueuedSave } from "@/offline/outbox";

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The network, in the top bar.
 *
 * Online, on a page that keeps working without it: a quiet "Works offline"
 * mark, so staff know this screen can be trusted through a network cut.
 * Offline: "Offline". Saves waiting on this computer: "3 waiting to sync".
 * Saves the server refused on arrival: "1 needs attention", which opens the
 * tray where each can be sent again or let go.
 */
export default function OfflineStatus() {
  const s = useOfflineState();
  const { pathname } = useLocation();
  const worksOffline = pageWorksOffline(pathname);
  const toast = useToast();
  const qc = useQueryClient();
  const [tray, setTray] = useState(false);

  useEffect(() => {
    // Shown just after the screen's own "saved" message, so this is the one that stays.
    const queued = (e: Event) => window.setTimeout(() => toast.warning(`No network - ${(e as CustomEvent).detail?.label ?? "the save"} is kept on this computer and will be sent when the network is back.`), 80);
    const synced = (e: Event) => {
      const n = (e as CustomEvent).detail?.count ?? 0;
      toast.success(`Network is back - ${n} saved change${n === 1 ? "" : "s"} sent.`);
      void qc.invalidateQueries();
    };
    window.addEventListener("offline-queued", queued);
    window.addEventListener("offline-synced", synced);
    // Signed in: anything this user left waiting on this computer goes now.
    void countSaves().then(() => sendWaiting());
    // An outage is noticed before a save fails: while a works-offline page is in
    // view (or saves wait), ask the server's health check every 20 s.
    const beat = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const st = getState();
      if (!pageWorksOffline(window.location.pathname) && !st.waiting) return;
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 5000);
      try {
        const r = await fetch(`${API_URL}/health`, { cache: "no-store", signal: ctl.signal });
        if (r.ok) { setOfflineState({ online: true }); void sendWaiting(); } else if (r.status >= 502) setOfflineState({ online: false });
      } catch {
        setOfflineState({ online: false });
      } finally {
        window.clearTimeout(t);
      }
    }, 20_000);
    return () => {
      window.clearInterval(beat);
      window.removeEventListener("offline-queued", queued);
      window.removeEventListener("offline-synced", synced);
    };
  }, [toast, qc]);

  const chip = (label: string, icon: React.ReactElement, color: string, bg: string, title: string, onClick?: () => void) => (
    <Tooltip title={title}>
      <Chip
        size="small" icon={icon} label={label} onClick={onClick}
        sx={{ height: 26, fontWeight: 700, fontSize: "0.72rem", color, bgcolor: bg, "& .MuiChip-icon": { color, fontSize: 17 }, cursor: onClick ? "pointer" : "default" }}
      />
    </Tooltip>
  );

  let shown: React.ReactNode = null;
  if (s.failed > 0) {
    shown = chip(`${s.failed} need${s.failed === 1 ? "s" : ""} attention`, <ErrorOutlineRounded />, "#b91c1c", "rgba(220,38,38,0.1)",
      "Saved while offline, but the server refused them when they arrived - open to see why", () => setTray(true));
  } else if (s.waiting > 0) {
    shown = chip(`${s.waiting} waiting to sync`, <SyncRounded sx={s.syncing ? { animation: "spin 1s linear infinite", "@keyframes spin": { to: { transform: "rotate(360deg)" } } } : undefined} />,
      "#b45309", "rgba(245,158,11,0.14)", "Saved on this computer while the network was down - sent automatically when it is back", () => setTray(true));
  } else if (!s.online) {
    shown = chip("Offline", <CloudOffRounded />, "#b45309", "rgba(245,158,11,0.14)",
      worksOffline ? "No network. This page keeps working - saves are sent when the network is back." : "No network. This page needs the network.");
  } else if (worksOffline) {
    shown = chip("Works offline", <CloudDoneOutlined />, "#047857", "rgba(16,185,129,0.1)",
      "If the network drops, this page keeps working: saves wait on this computer and are sent when it is back.");
  }

  return (
    <>
      {shown}
      {tray && <SyncTray onClose={() => setTray(false)} />}
    </>
  );
}

/** Under the top bar while offline: what this page can and cannot do. */
export function OfflineBanner() {
  const s = useOfflineState();
  const { pathname } = useLocation();
  if (s.online) return null;
  const worksOffline = pageWorksOffline(pathname);
  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 0.5, bgcolor: worksOffline ? "rgba(245,158,11,0.16)" : "rgba(220,38,38,0.1)", borderTop: "1px solid", borderColor: "divider" }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: worksOffline ? "#92400e" : "#991b1b" }}>
        {worksOffline
          ? `No network. This page keeps working - saves are kept on this computer and sent when the network is back.${s.showingSavedFrom ? ` Showing data as of ${time(s.showingSavedFrom)}.` : ""}`
          : "No network. This page needs the network - use the paper form and enter it when the network is back."}
      </Typography>
    </Box>
  );
}

/** The banner's height, for the space kept under the top bar. */
export const OFFLINE_BANNER_HEIGHT = 30;

function SyncTray({ onClose }: { onClose: () => void }) {
  const [saves, setSaves] = useState<QueuedSave[] | null>(null);
  const load = () => mySaves().then(setSaves);
  useEffect(() => { void load(); }, []);
  const act = async (fn: () => Promise<void>) => { await fn(); await load(); };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Saved on this computer</DialogTitle>
      <DialogContent dividers>
        {!saves ? null : saves.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Nothing waiting - everything has been sent.</Typography>
        ) : (
          <Stack spacing={1.25}>
            {saves.map((x) => (
              <Box key={x.id} sx={{ p: 1.25, borderRadius: 1.5, border: "1px solid", borderColor: x.state === "FAILED" ? "error.light" : "divider" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{x.label}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Saved at {time(x.queuedAt)} · {x.state === "FAILED" ? "refused by the server" : "waiting for the network"}
                </Typography>
                {x.error && <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 0.5 }}>{x.error}</Typography>}
                {x.state === "FAILED" && (
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => act(() => retrySave(x))} sx={{ textTransform: "none" }}>Send again</Button>
                    <Button size="small" color="error" onClick={() => act(() => discardSave(x.id))} sx={{ textTransform: "none" }}>Remove - I have entered it again</Button>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

import { useState } from "react";
import { Button, Menu, MenuItem, ListItemText } from "@mui/material";
import { SwapHorizRounded } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { PANEL_LABEL, panelHomeForUser, panelsForUser, type Panel } from "@/constants/roles";

/**
 * For someone who holds roles in more than one panel — a Medical Director who
 * also consults, a nurse who is also the ward's in-charge admin — a way across
 * without signing out (15_System_Roles: one staff, several roles). Renders
 * nothing for everyone else, which is nearly everyone.
 */
export default function PanelSwitcher() {
  const { user } = useHospitalAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const panels = panelsForUser(user);
  if (panels.length < 2) return null;
  const here = (pathname.split("/").filter(Boolean)[0] ?? "") as Panel;
  const others = panels.filter((p) => p !== here);
  if (!others.length) return null;

  return (
    <>
      <Button fullWidth size="small" variant="outlined" startIcon={<SwapHorizRounded />} onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: "none", fontWeight: 600, mb: 1, borderColor: "divider", color: "text.secondary" }}>
        Switch panel
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {others.map((p) => (
          <MenuItem key={p} onClick={() => { setAnchor(null); navigate(panelHomeForUser(user, p)); }}>
            <ListItemText primary={PANEL_LABEL[p]} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

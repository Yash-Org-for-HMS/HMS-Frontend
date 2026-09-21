import { Toolbar, Box } from "@mui/material";

/**
 * The product mark at the top of the sidebar.
 *
 * Swaps the roles the sidebar used to have: the product signs the top, and the
 * hospital identifies itself at the bottom next to the person signed in.
 *
 * Taller than the 70px header the other panels use, because a wordmark needs
 * air on both sides to read as placed rather than wedged — at 70px the mark
 * cleared the rules above and below by 11px and looked jammed in.
 */
export default function SidebarProductHeader() {
  return (
    <Toolbar
      sx={{
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "1px solid",
        borderColor: "divider",
        minHeight: "86px !important",
      }}
    >
      <Box
        component="img"
        src="/Dolphin_logo_blue.png"
        alt="Dolphin Hospital Management System"
        sx={{ width: 172, height: "auto", display: "block" }}
      />
    </Toolbar>
  );
}

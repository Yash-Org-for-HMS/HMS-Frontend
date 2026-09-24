import { createTheme, alpha, type ThemeOptions } from "@mui/material/styles";
import { BRAND, DISABLED_CONTAINED } from "./styles/accents";

const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    // The logo blue. Panels override primary via createPanelTheme, so this is
    // what the screens OUTSIDE a panel shell use — login, error pages, the
    // command palette — and it has to be the same family or those pages look
    // like a different product.
    primary: {
      main: BRAND.action,
      light: BRAND.actionLight,
      dark: "#07456E",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#EC4899",       // Pink
      light: "#F472B6",
      dark: "#BE185D",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F5F7",    // Apple-like very light gray
      paper: "#FFFFFF",      // White card surfaces
    },
    error: {
      main: "#EF4444",
      light: "#F87171",
    },
    warning: {
      main: "#F59E0B",
      light: "#FBBF24",
    },
    success: {
      main: "#10B981",
      light: "#34D399",
    },
    info: {
      main: "#3B82F6",
      light: "#60A5FA",
    },
    text: {
      primary: "#0F172A",
      secondary: "#475569",
    },
    divider: "rgba(15, 23, 42, 0.08)",
  },
  typography: {
    /**
     * `-apple-system` first, not "SF Pro Display".
     *
     * SF Pro Display is Apple's DISPLAY cut — drawn for large text, and
     * optically lighter and tighter at body sizes than the Text cut. Apple's
     * own guidance is to use Text below ~20pt, and naming Display explicitly
     * asked for the headline face to set 14px table cells. `-apple-system`
     * hands that choice to the OS, which picks the right optical size per
     * element. Windows falls through to Segoe UI Variable Text (11) or Segoe
     * UI (10), which is what actually rendered here all along.
     */
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", sans-serif',

    /**
     * Body weights, which the theme never set.
     *
     * Only h1–h6 and button were declared, so body1/body2/subtitle/caption fell
     * through to MUI's default 400 — while styles/typography.ts declares the
     * same text at 500. The result was two weights for one job: a component
     * spreading `typeScale.body` rendered at 500, and the far more common
     * `<Typography variant="body2">` rendered at 400. Most of the product was
     * on the lighter of the two, against its own ladder.
     */
    body1: { fontWeight: 500 },
    body2: { fontWeight: 500 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    caption: { fontWeight: 500 },
    overline: { fontWeight: 700 },

    h1: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
      letterSpacing: "0.01em",
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Always reserve space for the page scrollbar so switching tabs (which
        // changes content height, toggling the scrollbar) doesn't shift the
        // whole layout horizontally by the scrollbar width.
        html: {
          scrollbarGutter: "stable",
        },
        body: {
          backgroundcolor: "text.primary",
          color: "#0F172A",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 #F8FAFC",
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#F8FAFC",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E1",
            borderRadius: "4px",
          },
        },
        "@keyframes fadeInUp": {
          from: {
            opacity: 0,
            transform: "translate3d(0, 40px, 0)",
          },
          to: {
            opacity: 1,
            transform: "translate3d(0, 0, 0)",
          },
        },
        "@keyframes fadeInDown": {
          from: {
            opacity: 0,
            transform: "translate3d(0, -40px, 0)",
          },
          to: {
            opacity: 1,
            transform: "translate3d(0, 0, 0)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "10px 24px",
          // Body size, not a rung up. The old 0.95rem was between rungs and the
          // nearest was 1rem, but 16px button text against 14px body reads as
          // oversized in a dense clinical screen — and growing every button in
          // the product is the one change here that could push a tight row of
          // them off the edge. Matching body is both safer and more usual.
          fontSize: "0.875rem",
          boxShadow: "none",
        },
        // ONE action colour for every panel. Buttons deliberately do NOT follow
        // palette.primary (the panel accent) — a primary action should look the
        // same everywhere, so "Save" in Pharmacy matches "Save" in Reception.
        // Panel identity still comes through the sidebar, icons and headings,
        // which keep their own accent.
        containedPrimary: {
          background: `linear-gradient(135deg, ${BRAND.action} 0%, ${BRAND.actionDark} 100%)`,
          color: "#FFFFFF",
          border: "none",
          "&:hover": {
            background: `linear-gradient(135deg, ${BRAND.actionDark} 0%, ${BRAND.action} 100%)`,
            boxShadow: `0 8px 20px -6px ${alpha(BRAND.action, 0.5)}`,
          },
          "&.Mui-disabled": DISABLED_CONTAINED,
        },
        // Secondary/tertiary actions follow the same action colour, so a dialog
        // showing Cancel (text) beside Save (contained) reads as one control set
        // instead of two different palettes.
        outlinedPrimary: {
          borderColor: alpha(BRAND.action, 0.5),
          color: BRAND.action,
          "&:hover": { borderColor: BRAND.action, backgroundColor: alpha(BRAND.action, 0.06) },
        },
        textPrimary: {
          color: BRAND.action,
          "&:hover": { backgroundColor: alpha(BRAND.action, 0.06) },
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)",
          color: "#FFFFFF",
          "&:hover": {
            background: "linear-gradient(135deg, #DB2777 0%, #BE185D 100%)",
            boxShadow: "0 8px 20px -6px rgba(236, 72, 153, 0.5)",
          },
          "&.Mui-disabled": DISABLED_CONTAINED,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(15, 23, 42, 0.05)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
        },
        elevation2: {
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.05)",
        }
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // Focus ring follows the active (per-panel) primary accent.
        root: ({ theme }) => ({
          backgroundColor: "#FFFFFF",
          borderRadius: 8,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(15, 23, 42, 0.15)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(15, 23, 42, 0.3)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.primary.main,
            borderWidth: "1px",
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
          }
        }),
        // A search box narrower than its placeholder (common with long hints
        // like "Search by name, email, or employee code...") was hard-cropping
        // the text mid-character with no indication there was more. One fix at
        // the input level covers every field in the app: fade the overflow into
        // an ellipsis instead, same as a truncated table cell.
        input: {
          textOverflow: "ellipsis",
        },
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid rgba(15, 23, 42, 0.05)",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.02)",
          // Reserve the vertical scrollbar's space so it can't appear/disappear as
          // rows repaint on hover — the "scrollbar dance" that flickers scrollable
          // tables (same trick already used for the page scrollbar).
          scrollbarGutter: "stable",
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#F9FAFB",
          "& .MuiTableCell-root": {
            color: "text.secondary",
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            paddingTop: 16,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "16px 24px",
          borderBottom: "1px solid rgba(15, 23, 42, 0.04)",
          fontSize: "0.875rem",
          color: "#0F172A",
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.2s ease",
          // Only body rows should highlight on hover. Excluding header (and
          // footer) rows stops the sticky column-header from flickering/tinting
          // as the pointer passes over it.
          "&:not(.MuiTableRow-head):not(.MuiTableRow-footer):hover": {
            backgroundColor: "rgba(15, 23, 42, 0.02) !important",
          }
        }
      }
    }
  },
};
0
export const theme = createTheme(themeOptions);

/**
 * Build a panel-scoped theme whose primary accent is the given realm colour.
 * Each layout wraps its subtree in a ThemeProvider with one of these, so all
 * interactive elements (contained buttons, tab indicators, toggles, focused
 * inputs, links, progress) adopt that panel's accent — while semantic colours
 * (success/error/warning) and everything else stay exactly as in the base theme.
 */
export function createPanelTheme(main: string, dark: string) {
  return createTheme({
    ...themeOptions,
    palette: { ...themeOptions.palette, primary: { main, dark } },
  });
}

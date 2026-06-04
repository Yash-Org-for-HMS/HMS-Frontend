import { createTheme, type ThemeOptions } from "@mui/material/styles";

const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: "#4F46E5",       // Indigo
      light: "#818CF8",
      dark: "#3730A3",
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
    fontFamily: '"SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", sans-serif',
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
          fontSize: "0.95rem",
          boxShadow: "none",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          color: "#FFFFFF",
          border: "none",
          "&:hover": {
            background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)",
            boxShadow: "0 8px 20px -6px rgba(79, 70, 229, 0.5)",
          },
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)",
          color: "#FFFFFF",
          "&:hover": {
            background: "linear-gradient(135deg, #DB2777 0%, #BE185D 100%)",
            boxShadow: "0 8px 20px -6px rgba(236, 72, 153, 0.5)",
          },
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
        root: {
          backgroundColor: "#FFFFFF",
          borderRadius: 8,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(15, 23, 42, 0.15)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(15, 23, 42, 0.3)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#4F46E5",
            borderWidth: "1px",
            boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.15)",
          }
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid rgba(15, 23, 42, 0.05)",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.02)",
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
          fontSize: "0.9rem",
          color: "#0F172A",
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.2s ease",
          "&:hover": {
            backgroundColor: "rgba(15, 23, 42, 0.02) !important",
          }
        }
      }
    }
  },
};

export const theme = createTheme(themeOptions);

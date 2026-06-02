import { createTheme, type ThemeOptions } from "@mui/material/styles";

const themeOptions: ThemeOptions = {
  palette: {
    mode: "dark",
    primary: {
      main: "#00BFA6",       // Medical teal
      light: "#5DF2D6",
      dark: "#008C7A",
      contrastText: "#0A0E17",
    },
    secondary: {
      main: "#7C4DFF",       // Vibrant purple accent
      light: "#B47CFF",
      dark: "#3F1DCB",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#0A0E17",    // Deep navy
      paper: "#111827",      // Card surfaces
    },
    error: {
      main: "#FF5252",
      light: "#FF8A80",
    },
    warning: {
      main: "#FFB74D",
      light: "#FFE0B2",
    },
    success: {
      main: "#69F0AE",
      light: "#B9F6CA",
    },
    info: {
      main: "#40C4FF",
      light: "#80D8FF",
    },
    text: {
      primary: "#E8ECF4",
      secondary: "#8B95A9",
    },
    divider: "rgba(255, 255, 255, 0.08)",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
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
      letterSpacing: "0.02em",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: "thin",
          scrollbarColor: "#1E293B #0A0E17",
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#0A0E17",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#1E293B",
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
          borderRadius: 10,
          padding: "10px 24px",
          fontSize: "0.9rem",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #00BFA6 0%, #00E5CC 100%)",
          boxShadow: "0 4px 20px rgba(0, 191, 166, 0.3)",
          "&:hover": {
            background: "linear-gradient(135deg, #00A892 0%, #00D4BC 100%)",
            boxShadow: "0 6px 28px rgba(0, 191, 166, 0.45)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(20px)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);

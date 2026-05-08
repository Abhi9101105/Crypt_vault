export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0f1117",
          secondary: "#161a23",
          elevated: "#1e2330",
          hover: "#252b3b",
        },
        border: {
          DEFAULT: "#2a3040",
          light: "#353d50",
        },
        text: {
          primary: "#e8eaed",
          secondary: "#8b95a5",
          muted: "#5f6b7a",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          muted: "rgba(99,102,241,0.15)",
        },
        success: {
          DEFAULT: "#22c55e",
          muted: "rgba(34,197,94,0.15)",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "rgba(239,68,68,0.15)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "rgba(245,158,11,0.15)",
        },
        vault: "#136f63",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(99,102,241,0.15)",
        soft: "0 18px 60px rgba(0,0,0,0.25)",
        card: "0 4px 24px rgba(0,0,0,0.15)",
        modal: "0 25px 80px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.35s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "shimmer": "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

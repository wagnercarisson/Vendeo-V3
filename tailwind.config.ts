/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "#020617",
          surface: "#0F172A",
          elevated: "#1E293B",
          hover: "#334155",
        },
        border: {
          DEFAULT: "#1E293B",
          light: "#334155",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#94A3B8",
          muted: "#64748B",
          disabled: "#475569",
        },
        accent: {
          green: "#22C55E",
          blue: "#3B82F6",
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body: ["Open Sans", "sans-serif"],
      },
      animation: {
        "skeleton-shimmer": "skeleton-shimmer 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

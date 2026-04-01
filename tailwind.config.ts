import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1F1F1F",
        cream: "#F5F5F5",
        glow: "#ecf3b7",
        mid: "#6B7280",
        muted: "#9CA3AF",
        border: "#E5E7EB",
        brand: "#6686F7",
        "green-sem": "#2d6a4f",
        "green-bg": "#c8f0da",
        "amber-sem": "#b5451b",
        "amber-bg": "#fde8d0",
        "red-sem": "#6b2737",
        "red-bg": "#fce0e0",
      },
      fontFamily: {
        sans: ["Urbanist", "Arial", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(102,134,247,0.10)",
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canada.ca red — handy for UI chrome around the preview
        canada: "#EA2D37",
      },
    },
  },
  plugins: [],
};

export default config;

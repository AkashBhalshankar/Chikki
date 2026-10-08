/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        chikki: {
          bg: "#0B0B0B",
          panel: "#1c1c1c",
          purple: "#7F77DD",
          purpleLight: "#AFA9EC",
          green: "#639922",
          hand: "#D85A30",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

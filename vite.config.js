import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/codespaces-react/", // <-- Das ist die entscheidende Ergänzung!
  server: {
    historyApiFallback: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
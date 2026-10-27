import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// VITE_APP_ENV picks the backend (src/lib/api.ts). When it isn't set, a Vercel
// build follows its environment: Production → prod, Preview → stage.
const vercelAppEnv = () =>
  process.env.VERCEL_ENV === "production" ? "prod" : process.env.VERCEL_ENV === "preview" ? "stage" : "";

export default defineConfig(({ mode }) => {
  const appEnv = loadEnv(mode, process.cwd(), "VITE_").VITE_APP_ENV || vercelAppEnv();
  return {
    plugins: [react()],
    define: { "import.meta.env.VITE_APP_ENV": JSON.stringify(appEnv) }
  };
});

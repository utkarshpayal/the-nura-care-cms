/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_ENV?: "prod" | "stage";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

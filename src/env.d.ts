/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_CLIENT_ID:    string;
  readonly VITE_AZURE_REDIRECT_URI: string;
  readonly VITE_API_URL?:           string;
  // añade aquí nuevas variables `VITE_*` cuando las necesites
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

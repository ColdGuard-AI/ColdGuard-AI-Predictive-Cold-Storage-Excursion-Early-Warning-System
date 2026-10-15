/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

declare module "*.jsx";
declare module "./components/*";
declare module "./data/*";

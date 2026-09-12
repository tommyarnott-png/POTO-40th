/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the full-resolution source downloads (master WAVs and the
   * grouped-stem archive). Those files are far too large for git, so they are
   * hosted separately; when this is unset the source download links are hidden.
   * See docs/ASSETS.md.
   */
  readonly VITE_SOURCE_AUDIO_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

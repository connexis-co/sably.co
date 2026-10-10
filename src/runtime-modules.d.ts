declare module 'virtual:sably-runtime' {
  /** Build-time alias selects native Node bindings or Cloudflare's env export. */
  export const env: Record<string, string | undefined> & {
    DB: D1Database;
    SABLY_DB: D1Database;
    EMDASH_ENCRYPTION_KEY?: string;
  };
}

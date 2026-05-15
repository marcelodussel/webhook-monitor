export const INGEST_BASE_URL =
  process.env.NEXT_PUBLIC_INGEST_BASE_URL?.trim().replace(/\/+$/, "") ||
  "https://api.hookline.dev/hooks";

export const APP_NAME = "Hookline";

/** Public repo URL for marketing links; empty hides Source / View Source CTAs. */
export const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim() || "";

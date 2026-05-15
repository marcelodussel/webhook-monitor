import packageJson from "../../package.json";

export function getAppDisplayVersion(): string {
  const env = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (env) return env;
  return packageJson.version;
}

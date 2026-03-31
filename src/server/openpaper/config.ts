import { env } from "~/env";

export function isOpenPaperServerEnabled(): boolean {
  return (
    env.OPENPAPER_ENABLED === "true" &&
    Boolean(env.OPENPAPER_API_URL?.length)
  );
}

export function getOpenPaperApiBase(): string {
  const base = env.OPENPAPER_API_URL;
  if (!base) throw new Error("OPENPAPER_API_URL is not set");
  return base.replace(/\/$/, "");
}

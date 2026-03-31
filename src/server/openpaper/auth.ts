import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Resolves Bearer token for Open Paper: per-user DB token, else optional default env token.
 */
export async function getOpenPaperBearerToken(
  userId: string,
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { openPaperSessionToken: true },
  });
  const fromUser = user?.openPaperSessionToken?.trim();
  if (fromUser) return fromUser;
  const fallback = env.OPENPAPER_DEFAULT_BEARER_TOKEN?.trim();
  return fallback || null;
}

import { db } from "~/server/db";

const GUEST_EMAIL = "guest@fratnotes.local";

export async function getEffectiveUserId(session: {
  user?: { id?: string | null } | null;
} | null) {
  if (session?.user?.id) {
    return session.user.id;
  }

  const guestUser = await db.user.upsert({
    where: { email: GUEST_EMAIL },
    update: {},
    create: {
      email: GUEST_EMAIL,
      name: "Guest User",
    },
    select: { id: true },
  });

  return guestUser.id;
}

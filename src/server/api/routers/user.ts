import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getOpenPaperBearerToken } from "~/server/openpaper/auth";
import { isOpenPaperServerEnabled } from "~/server/openpaper/config";
import { openPaperJson } from "~/server/openpaper/fetch";

export const userRouter = createTRPCRouter({
  setOpenPaperSessionToken: protectedProcedure
    .input(z.object({ token: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          openPaperSessionToken: input.token ?? null,
        },
      });
      return { ok: true as const };
    }),

  getOpenPaperSettings: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        openPaperSessionToken: true,
        openPaperKbConversationId: true,
      },
    });
    return {
      hasSessionToken: Boolean(user?.openPaperSessionToken?.trim()),
      kbConversationId: user?.openPaperKbConversationId ?? null,
      integrationEnabled: isOpenPaperServerEnabled(),
    };
  }),

  ensureKbConversation: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isOpenPaperServerEnabled()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Open Paper is not configured (OPENPAPER_ENABLED + OPENPAPER_API_URL).",
      });
    }
    const userId = ctx.session.user.id;
    const existing = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { openPaperKbConversationId: true },
    });
    if (existing?.openPaperKbConversationId) {
      return { conversationId: existing.openPaperKbConversationId };
    }

    const bearer = await getOpenPaperBearerToken(userId);
    if (!bearer) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Add an Open Paper session token in Settings (or OPENPAPER_DEFAULT_BEARER_TOKEN for dev).",
      });
    }

    const created = await openPaperJson<{ id: string }>(
      "/api/conversation/everything",
      bearer,
      { method: "POST" },
    );

    await ctx.db.user.update({
      where: { id: userId },
      data: { openPaperKbConversationId: created.id },
    });

    return { conversationId: created.id };
  }),
});

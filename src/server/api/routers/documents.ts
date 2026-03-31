import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getEffectiveUserId } from "~/server/lib/effective-user";

export const documentsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const userId = await getEffectiveUserId(ctx.session);

    return ctx.db.document.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);

      const doc = await ctx.db.document.findFirst({
        where: { id: input.id, userId },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return {
        ...doc,
        originalPdf: Buffer.from(doc.originalPdf).toString("base64"),
        annotations: JSON.parse(doc.annotations) as unknown[],
        editorState: JSON.parse(doc.editorState) as Record<string, unknown>,
        drawingData: JSON.parse(doc.drawingData) as unknown[],
      };
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string(),
        pdfBase64: z.string().optional(),
        extractedText: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);
      const pdfBuffer = input.pdfBase64
        ? Buffer.from(input.pdfBase64, "base64")
        : Buffer.from("");
      return ctx.db.document.create({
        data: {
          title: input.title,
          originalPdf: pdfBuffer,
          extractedText: input.extractedText,
          userId,
        },
      });
    }),

  updateAnnotations: publicProcedure
    .input(
      z.object({
        id: z.string(),
        annotations: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);
      const existing = await ctx.db.document.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      return ctx.db.document.update({
        where: { id: input.id },
        data: { annotations: input.annotations },
      });
    }),

  updateEditorState: publicProcedure
    .input(
      z.object({
        id: z.string(),
        editorState: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);
      const existing = await ctx.db.document.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      return ctx.db.document.update({
        where: { id: input.id },
        data: { editorState: input.editorState },
      });
    }),

  updateDrawingData: publicProcedure
    .input(
      z.object({
        id: z.string(),
        drawingData: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);
      const existing = await ctx.db.document.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      return ctx.db.document.update({
        where: { id: input.id },
        data: { drawingData: input.drawingData },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getEffectiveUserId(ctx.session);
      const existing = await ctx.db.document.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      return ctx.db.document.delete({
        where: { id: input.id },
      });
    }),
});

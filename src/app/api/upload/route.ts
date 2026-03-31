import { NextResponse } from "next/server";

import { parsePdfFromArrayBuffer } from "~/lib/pdf-parser";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getEffectiveUserId } from "~/server/lib/effective-user";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file was provided." },
        { status: 400 },
      );
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded PDF is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "PDF is too large. Please upload a file under 10 MB." },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parsePdfFromArrayBuffer(arrayBuffer);

    if (!parsed.text.trim()) {
      return NextResponse.json(
        {
          error:
            "This PDF did not contain extractable text. Try a text-based PDF instead of a scanned image.",
        },
        { status: 422 },
      );
    }

    const session = await auth();
    const userId = await getEffectiveUserId(session);

    const document = await db.document.create({
      data: {
        title: parsed.title || file.name.replace(/\.pdf$/i, ""),
        originalPdf: Buffer.from(arrayBuffer),
        extractedText: parsed.text,
        userId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    return NextResponse.json({
      id: document.id,
      title: document.title,
    });
  } catch (error) {
    console.error("Upload route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload and parse the PDF.",
      },
      { status: 500 },
    );
  }
}

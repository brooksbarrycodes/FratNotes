import { PDFParse } from "pdf-parse";

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function deriveTitle(fullText) {
  const titleMatch = fullText.match(/^(.{1,80})/);
  return titleMatch?.[1]?.trim() ?? "Untitled Document";
}

async function main() {
  const base64 = await readStdin();
  const data = Buffer.from(base64, "base64");
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    const pages = result.pages
      .map((page) => page.text.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const text = pages.join("\n\n");

    process.stdout.write(
      JSON.stringify({
        title: deriveTitle(text),
        text,
        pages,
      }),
    );
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(
    error instanceof Error ? error.message : "Unknown PDF parsing error",
  );
  process.exit(1);
});

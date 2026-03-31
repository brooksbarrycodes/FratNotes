import "server-only";

import path from "node:path";
import { spawn } from "node:child_process";

export interface ParsedPdfResult {
  title: string;
  text: string;
  pages: string[];
}

function deriveTitle(fullText: string) {
  const titleMatch = fullText.match(/^(.{1,80})/);
  return titleMatch?.[1]?.trim() ?? "Untitled Document";
}

export async function parsePdfFromBuffer(
  data: Uint8Array,
): Promise<ParsedPdfResult> {
  const runnerPath = path.join(process.cwd(), "scripts", "pdf-parse-runner.mjs");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            Buffer.concat(stderrChunks).toString("utf8") ||
              "Failed to parse the PDF.",
          ),
        );
        return;
      }

      try {
        const raw = Buffer.concat(stdoutChunks).toString("utf8");
        const parsed = JSON.parse(raw) as ParsedPdfResult;

        resolve({
          title: parsed.title || deriveTitle(parsed.text),
          text: parsed.text,
          pages: parsed.pages,
        });
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(Buffer.from(data).toString("base64"));
  });
}

export async function parsePdfFromArrayBuffer(
  buffer: ArrayBuffer,
): Promise<ParsedPdfResult> {
  return parsePdfFromBuffer(new Uint8Array(buffer));
}

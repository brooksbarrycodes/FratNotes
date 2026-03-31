"use client";

import { useState } from "react";
import { IconDownload } from "@tabler/icons-react";

interface PdfExportButtonProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  title: string;
}

export function PdfExportButton({ targetRef, title }: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current) return;
    setIsExporting(true);

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const element = targetRef.current;
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
        filename: `${title}-FratNotes.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: "in",
          format: "letter",
          orientation: "portrait" as const,
        },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 rounded-xl bg-flame px-4 py-2 font-display text-sm font-semibold text-white shadow-md shadow-flame/20 transition-all hover:bg-flame-dark hover:shadow-lg active:scale-95 disabled:opacity-50"
    >
      {isExporting ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Exporting...
        </>
      ) : (
        <>
          <IconDownload className="h-4 w-4" />
          Download PDF
        </>
      )}
    </button>
  );
}

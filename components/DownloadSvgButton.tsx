"use client";

import { BranchedConnection } from "../lib/types";
import { prepareSvgForExport } from "../lib/prepareSvgForExport";

type DownloadSvgButtonProps = {
  connections: BranchedConnection[];
  canvasWidth: number;
  canvasHeight: number;
};

/**
 * Generates a filename for the exported SVG.
 */
function generateFilename(): string {
  return `sfcm-symbol-${Date.now()}.svg`;
}

/**
 * Triggers a download of the provided SVG string as a file.
 */
function downloadSvg(svgString: string, filename: string): void {
  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/**
 * Button component for downloading the current SVG symbol.
 * Finds the on-screen SVG preview, prepares it for export, and triggers download.
 */
export default function DownloadSvgButton({
  connections,
  canvasWidth,
  canvasHeight,
}: DownloadSvgButtonProps) {
  const handleDownload = (): void => {
    const originalSvg = document.querySelector(
      ".svg-preview"
    ) as SVGSVGElement | null;

    if (!originalSvg) {
      console.error("DownloadSvgButton: .svg-preview element not found");
      return;
    }

    const finalSvg = prepareSvgForExport(originalSvg, canvasWidth, canvasHeight);
    const filename = generateFilename();
    downloadSvg(finalSvg, filename);
  };

  if (connections.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={connections.length === 0}
      style={{
        padding: "0.5rem 1rem",
        border: "1px solid #ffffff",
        background: "transparent",
        color: "#ffffff",
        cursor: connections.length === 0 ? "not-allowed" : "pointer",
        fontFamily: "Times New Roman, serif",
        fontSize: "1rem",
        borderRadius: "4px",
      }}
    >
      Download SVG
    </button>
  );
}

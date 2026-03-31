/**
 * React ports of EmbedPDF snippet default icons (embed-pdf-viewer v2.11.0,
 * viewers/snippet/src/components/icons). MIT — see upstream LICENSE.
 *
 * `accentColor` maps to EmbedPDF command iconProps primaryColor (tool defaults).
 * `detailColor` is used for secondary strokes (letterforms, pencil body) like the themed UI.
 */
import type { SVGProps } from "react";

export type EmbedPdfSnippetIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  /** Tool / stroke accent (EmbedPDF primaryColor) */
  accentColor?: string;
  /** Secondary line work inside composite glyphs */
  detailColor?: string;
};

const INK_DETAIL = "#3d3d54";

function svgBase({
  size = 24,
  className,
  accentColor,
  detailColor,
  ...rest
}: EmbedPdfSnippetIconProps) {
  const { style, ...svgRest } = rest;
  return {
    width: size,
    height: size,
    className,
    fill: "none" as const,
    style,
    ...svgRest,
  };
}

export function EmbedPdfPointerIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor, detailColor, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  const stroke = accentColor ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047 -1.047a1.067 1.067 0 0 0 0 -1.509l-4.907 -4.907l3.113 -2.09a1.2 1.2 0 0 0 -.309 -2.228l-13.582 -3.904l3.904 13.563z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfHighlightIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#FFCD45", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <rect x="2" y="6" width="20" height="16" rx="2" fill={accentColor} stroke="none" />
      <path
        d="M8 16v-8a4 4 0 1 1 8 0v8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfUnderlineIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M4 20h16"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16v-8a4 4 0 1 1 8 0v8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfStrikethroughIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M8 16v-8a4 4 0 1 1 8 0v8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 10h16"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfSquigglyIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M8 16v-8a4 4 0 1 1 8 0v8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20c1.5 -1.5 3.5 -1.5 5 0s3.5 1.5 5 0 3.5 -1.5 5 0"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfPencilMarkerIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path
        d="m9.109 16.275 8.856-8.097c.812-.743.87-2.014.127-2.826s-2.014-.869-2.826-.127L6.41 13.322l-.127 2.826zM13.79 6.575l2.7 2.952"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.375 20.125c.569.063-4.05-.562-6.412-.437s-4.759 1.229-6.857 1.625c-1.764.687-3.404-.938-1.981-2.5"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfInkHighlighterIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#FFCD45", detailColor = INK_DETAIL, ...rest } = props;
  const p = svgBase({ ...rest, accentColor, detailColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M3 19h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 5.5l4 4"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 13.5l4 4"
        stroke={detailColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 15v4h-8l4 -4l4 0"
        stroke={accentColor}
        fill={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfMessageIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#FFCD45", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M8 9h8"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 13h6"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfFreeTextIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M4 7v-2h12v2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5v14"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 19h-4"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 13v-1h6v1"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 12v7"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 19h2"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfSquareIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EmbedPdfCircleIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EmbedPdfLineIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M20 4l-16 16"
        stroke={accentColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfLineArrowIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M20 4l-16 16"
        stroke={accentColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3h5v5"
        stroke={accentColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfZigzagIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path
        d="M12 2.4L21.36 11.76L2.64 12.24L12 21.6"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfPolygonIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor = "#E44234", ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M13.163 2.168l8.021 5.828c.694 .504 .984 1.397 .719 2.212l-3.064 9.43a1.978 1.978 0 0 1 -1.881 1.367h-9.916a1.978 1.978 0 0 1 -1.881 -1.367l-3.064 -9.43a1.978 1.978 0 0 1 .719 -2.212l8.021 -5.828a1.978 1.978 0 0 1 2.326 0z"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EmbedPdfArrowBackUpIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor, ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  const stroke = accentColor ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M9 14l-4 -4l4 -4"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10h11a4 4 0 1 1 0 8h-1"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfPaletteIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor, ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  const stroke = accentColor ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"
        fill="#E44234"
        stroke="none"
      />
      <path
        d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"
        fill="#FFCD45"
        stroke="none"
      />
      <path
        d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"
        fill="#87CEFA"
        stroke="none"
      />
    </svg>
  );
}

export function EmbedPdfChevronDownIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor, ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  const stroke = accentColor ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M6 9l6 6l6 -6"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmbedPdfDownloadIcon(props: EmbedPdfSnippetIconProps) {
  const { accentColor, ...rest } = props;
  const p = svgBase({ ...rest, accentColor });
  const stroke = accentColor ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 11l5 5l5 -5"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 4l0 12"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

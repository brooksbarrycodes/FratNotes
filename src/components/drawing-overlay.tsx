"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { getStroke } from "perfect-freehand";

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  points: Point[];
  color: string;
}

interface DrawingOverlayProps {
  isActive: boolean;
  color: string;
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x, y], i, arr) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = arr[i - 1]!;
      const mx = (px! + x!) / 2;
      const my = (py! + y!) / 2;
      return `${acc} Q ${px} ${py}, ${mx} ${my}`;
    },
    "",
  );

  return `${d} Z`;
}

export function DrawingOverlay({
  isActive,
  color,
  strokes,
  onStrokesChange,
}: DrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPointerPos = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isActive) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsDrawing(true);
      setCurrentPoints([getPointerPos(e)]);
    },
    [isActive, getPointerPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      setCurrentPoints((prev) => [...prev, getPointerPos(e)]);
    },
    [isDrawing, getPointerPos],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length > 1) {
      onStrokesChange([
        ...strokes,
        { points: currentPoints, color },
      ]);
    }
    setCurrentPoints([]);
  }, [isDrawing, currentPoints, strokes, color, onStrokesChange]);

  const renderStroke = (points: Point[], strokeColor: string) => {
    const strokePoints = getStroke(
      points.map((p) => [p.x, p.y, p.pressure ?? 0.5]),
      {
        size: 4,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      },
    );
    return (
      <path
        d={getSvgPathFromStroke(strokePoints)}
        fill={strokeColor}
        opacity={0.8}
      />
    );
  };

  return (
    <svg
      ref={svgRef}
      className="pointer-events-auto absolute inset-0 h-full w-full"
      style={{
        cursor: isActive ? "crosshair" : "default",
        pointerEvents: isActive ? "auto" : "none",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {strokes.map((stroke, i) => (
        <g key={i}>{renderStroke(stroke.points, stroke.color)}</g>
      ))}
      {currentPoints.length > 0 && (
        <g>{renderStroke(currentPoints, color)}</g>
      )}
    </svg>
  );
}

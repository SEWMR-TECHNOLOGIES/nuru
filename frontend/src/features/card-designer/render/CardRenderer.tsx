/**
 * Pure renderer of a CardDesignDoc onto a react-konva Stage.
 * Used identically by the organizer preview AND the per-guest download.
 */
import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Rect, Text, Image as KImage, Circle, Line, Group } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { CardDesignDoc, CardLayer } from "@/lib/api/invitationTemplates";
import { applyPlaceholders, RenderContext } from "./placeholders";
import { qrDataUrl } from "./qr";

interface Props {
  doc: CardDesignDoc;
  context: RenderContext;
  qrPayload: string;
  scale?: number; // visual scale applied to canvas
  pixelRatio?: number; // for PNG export
}

export interface CardRendererHandle {
  toDataUrl: (pixelRatio?: number) => string | undefined;
}

const RasterImage = ({ src, l, fit }: { src: string; l: CardLayer; fit?: "cover" | "contain" | "fill" }) => {
  const [img] = useImage(src, "anonymous");
  if (!img) return null;
  let w = l.width, h = l.height, x = 0, y = 0;
  const ratio = img.width / img.height;
  if (fit === "contain") {
    if (ratio > l.width / l.height) {
      h = l.width / ratio;
      y = (l.height - h) / 2;
    } else {
      w = l.height * ratio;
      x = (l.width - w) / 2;
    }
  } else if (fit === "cover") {
    if (ratio > l.width / l.height) {
      w = l.height * ratio;
      x = (l.width - w) / 2;
    } else {
      h = l.width / ratio;
      y = (l.height - h) / 2;
    }
  }
  return <KImage image={img} x={x} y={y} width={w} height={h} />;
};

const QrImage = ({ payload, size, fg, bg }: { payload: string; size: number; fg: string; bg: string }) => {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    qrDataUrl(payload, size, fg, bg).then(u => { if (alive) setSrc(u); });
    return () => { alive = false; };
  }, [payload, size, fg, bg]);
  const [img] = useImage(src);
  if (!img) return <Rect width={size} height={size} fill={bg} />;
  return <KImage image={img} width={size} height={size} />;
};

export const CardRenderer = forwardRef<CardRendererHandle, Props>(function CardRenderer(
  { doc, context, qrPayload, scale = 1, pixelRatio = 2 },
  ref,
) {
  const stageRef = useRef<Konva.Stage | null>(null);
  useImperativeHandle(ref, () => ({
    toDataUrl: (pr?: number) =>
      stageRef.current?.toDataURL({ pixelRatio: pr ?? pixelRatio, mimeType: "image/png" }),
  }));

  const ctx: RenderContext = useMemo(() => ({ ...context, qr_code: qrPayload }), [context, qrPayload]);
  const cw = doc.canvas.width;
  const ch = doc.canvas.height;

  return (
    <Stage
      ref={stageRef}
      width={cw * scale}
      height={ch * scale}
      scale={{ x: scale, y: scale }}
      style={{ background: doc.canvas.backgroundColor || "#fff" }}
    >
      <Layer listening={false}>
        <Rect width={cw} height={ch} fill={doc.canvas.backgroundColor || "#FFFFFF"} />
        {doc.canvas.backgroundImageUrl && (
          <RasterImage src={doc.canvas.backgroundImageUrl} l={{ width: cw, height: ch } as CardLayer} fit="cover" />
        )}
      </Layer>
      <Layer>
        {doc.layers.filter(l => l.visible !== false).map(l => {
          const common = {
            x: l.x,
            y: l.y,
            opacity: l.opacity ?? 1,
            rotation: l.rotation ?? 0,
            offsetX: 0,
            offsetY: 0,
          };
          if (l.type === "text") {
            const resolved = applyPlaceholders(l.text || l.placeholder || "", ctx);
            return (
              <Text
                key={l.id}
                {...common}
                width={l.width}
                height={l.height}
                text={resolved}
                fontFamily={l.style.fontFamily || "Inter"}
                fontSize={l.style.fontSize || 32}
                fontStyle={`${l.style.fontStyle || "normal"} ${l.style.fontWeight || 400}`.trim()}
                fill={l.style.color || "#111"}
                align={l.style.textAlign || "left"}
                lineHeight={l.style.lineHeight || 1.2}
                letterSpacing={l.style.letterSpacing || 0}
                wrap={l.wrap === false ? "none" : "word"}
                ellipsis={l.wrap === false}
                shadowColor={l.style.shadowColor || undefined}
                shadowBlur={l.style.shadowBlur || 0}
              />
            );
          }
          if (l.type === "shape") {
            if (l.shape === "circle") {
              const r = Math.min(l.width, l.height) / 2;
              return (
                <Circle
                  key={l.id}
                  {...common}
                  x={l.x + r}
                  y={l.y + r}
                  radius={r}
                  fill={l.style.fill || "#000"}
                  stroke={l.style.stroke}
                  strokeWidth={l.style.strokeWidth || 0}
                />
              );
            }
            if (l.shape === "line") {
              return (
                <Line
                  key={l.id}
                  {...common}
                  points={[0, l.height / 2, l.width, l.height / 2]}
                  stroke={l.style.stroke || l.style.fill || "#000"}
                  strokeWidth={l.style.strokeWidth || 2}
                />
              );
            }
            return (
              <Rect
                key={l.id}
                {...common}
                width={l.width}
                height={l.height}
                fill={l.style.fill || "#000"}
                stroke={l.style.stroke}
                strokeWidth={l.style.strokeWidth || 0}
                cornerRadius={l.style.cornerRadius || 0}
              />
            );
          }
          if (l.type === "image" && l.src) {
            return (
              <Group key={l.id} {...common} clipFunc={(c) => {
                const r = l.borderRadius || 0;
                c.beginPath();
                c.moveTo(r, 0);
                c.lineTo(l.width - r, 0);
                c.quadraticCurveTo(l.width, 0, l.width, r);
                c.lineTo(l.width, l.height - r);
                c.quadraticCurveTo(l.width, l.height, l.width - r, l.height);
                c.lineTo(r, l.height);
                c.quadraticCurveTo(0, l.height, 0, l.height - r);
                c.lineTo(0, r);
                c.quadraticCurveTo(0, 0, r, 0);
                c.closePath();
              }}>
                <RasterImage src={l.src} l={l} fit={l.fit || "cover"} />
              </Group>
            );
          }
          if (l.type === "qr") {
            const size = Math.min(l.width, l.height);
            const pad = l.style.padding || 0;
            return (
              <Group key={l.id} {...common}>
                <Rect
                  width={l.width}
                  height={l.height}
                  fill={l.style.backgroundColor || "#FFFFFF"}
                  cornerRadius={l.style.borderRadius || 0}
                />
                <Group x={(l.width - size) / 2 + pad} y={(l.height - size) / 2 + pad}>
                  <QrImage
                    payload={ctx.qr_code || qrPayload}
                    size={size - pad * 2}
                    fg={l.style.foregroundColor || "#000"}
                    bg={l.style.backgroundColor || "#FFF"}
                  />
                </Group>
              </Group>
            );
          }
          return null;
        })}
      </Layer>
    </Stage>
  );
});

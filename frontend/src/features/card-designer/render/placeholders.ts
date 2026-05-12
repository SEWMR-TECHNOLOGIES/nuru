/**
 * Replace {{placeholders}} inside any template string with values from a
 * dynamic context. Used both at preview time (sample data) and at guest
 * download time (real invitation data).
 */
import type { GuestCardData } from "@/lib/api/invitationTemplates";

export type RenderContext = GuestCardData["context"] & { qr_code?: string };

export const SAMPLE_CONTEXT: RenderContext = {
  guest_name: "Mgeni Wako",
  event_title: "Tukio Lako",
  event_date: "Jumamosi, 15 Machi 2026",
  event_time: "06:00 PM",
  event_location: "Serena Hotel, Dar es Salaam",
  organizer_name: "Nuru Tanzania",
  invite_code: "NURU-PREVIEW-001",
  qr_code: "NURU-PREVIEW-001",
};

const KEYS: (keyof RenderContext)[] = [
  "guest_name",
  "event_title",
  "event_date",
  "event_time",
  "event_location",
  "organizer_name",
  "invite_code",
  "qr_code",
];

export function applyPlaceholders(input: string, ctx: RenderContext): string {
  if (!input) return "";
  let out = input;
  for (const key of KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    out = out.replace(re, String(ctx[key] ?? ""));
  }
  return out;
}

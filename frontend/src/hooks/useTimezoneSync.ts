/**
 * One-shot capture of the browser timezone, PATCHed to /users/me so the
 * reminder scheduler fires at the organiser's local time. Stores a hash of
 * the last-synced timezone in localStorage so we don't spam the API.
 */
import { useEffect } from "react";
import { patch } from "@/lib/api/helpers";

const STORAGE_KEY = "user_timezone_synced";

export function useTimezoneSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    const key = `${STORAGE_KEY}:${userId}`;
    if (localStorage.getItem(key) === tz) return;
    patch("/users/me", { timezone: tz })
      .then((r) => {
        if (r.success) localStorage.setItem(key, tz);
      })
      .catch(() => {});
  }, [userId]);
}

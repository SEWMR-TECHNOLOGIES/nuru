/**
 * Feed Interaction Tracking Hook
 * 
 * Tracks user interactions with feed posts for the ranking algorithm.
 * Uses IntersectionObserver for viewport tracking and batches interactions
 * to minimize API calls.
 */

import { useCallback, useEffect, useRef } from 'react';
import { socialApi } from '@/lib/api/social';

type InteractionType =
  | 'view'
  | 'dwell'
  | 'glow'
  | 'unglow'
  | 'comment'
  | 'echo'
  | 'spark'
  | 'save'
  | 'unsave'
  | 'click_image'
  | 'click_profile'
  | 'hide'
  | 'report'
  | 'expand';

interface PendingInteraction {
  post_id: string;
  interaction_type: InteractionType;
  dwell_time_ms?: number;
}

// Generate a session ID per page load
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Detect device type
const getDeviceType = (): string => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

// Batching queue
let interactionQueue: PendingInteraction[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_BATCH_SIZE = 30;

async function flushInteractions() {
  if (interactionQueue.length === 0) return;

  const batch = interactionQueue.splice(0, MAX_BATCH_SIZE);

  try {
    await socialApi.logInteractionBatch({
      interactions: batch,
      session_id: SESSION_ID,
      device_type: getDeviceType(),
    });
  } catch {
    // Silent fail - interaction tracking is best-effort
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushInteractions();
  }, FLUSH_INTERVAL_MS);
}

function queueInteraction(interaction: PendingInteraction) {
  interactionQueue.push(interaction);
  if (interactionQueue.length >= MAX_BATCH_SIZE) {
    flushInteractions();
  } else {
    scheduleFlush();
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (interactionQueue.length > 0) {
      // Use sendBeacon for reliability
      const payload = JSON.stringify({
        interactions: interactionQueue,
        session_id: SESSION_ID,
        device_type: getDeviceType(),
      });
      // Best-effort: navigator.sendBeacon doesn't work with custom headers
      // Fall back to sync flush
      flushInteractions();
    }
  });
}

/**
 * Hook to track post viewport visibility and dwell time.
 * Attach the returned ref to the post container element.
 */
export function usePostViewTracking(postId: string | undefined) {
  const elementRef = useRef<HTMLDivElement>(null);
  const viewLogged = useRef(false);
  const dwellStartRef = useRef<number | null>(null);
  const dwellLoggedRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !postId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Log view (once per mount)
            if (!viewLogged.current) {
              viewLogged.current = true;
              queueInteraction({ post_id: postId, interaction_type: 'view' });
            }
            // Start dwell timer
            if (!dwellStartRef.current) {
              dwellStartRef.current = Date.now();
            }
          } else {
            // Post left viewport - log dwell if significant
            if (dwellStartRef.current && !dwellLoggedRef.current) {
              const dwellMs = Date.now() - dwellStartRef.current;
              if (dwellMs >= 3000) { // Only log if >3s
                dwellLoggedRef.current = true;
                queueInteraction({
                  post_id: postId,
                  interaction_type: 'dwell',
                  dwell_time_ms: dwellMs,
                });
              }
            }
            dwellStartRef.current = null;
          }
        }
      },
      { threshold: 0.5 } // 50% of post must be visible
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      // Log dwell on unmount if still viewing
      if (dwellStartRef.current && !dwellLoggedRef.current) {
        const dwellMs = Date.now() - dwellStartRef.current;
        if (dwellMs >= 3000) {
          queueInteraction({
            post_id: postId,
            interaction_type: 'dwell',
            dwell_time_ms: dwellMs,
          });
        }
      }
    };
  }, [postId]);

  return elementRef;
}

/**
 * Hook to log explicit user interactions (glow, comment, etc.)
 */
export function useInteractionLogger() {
  const logInteraction = useCallback(
    (postId: string, type: InteractionType, extra?: { dwell_time_ms?: number }) => {
      queueInteraction({
        post_id: postId,
        interaction_type: type,
        ...extra,
      });
    },
    []
  );

  return { logInteraction, sessionId: SESSION_ID };
}

export { SESSION_ID as feedSessionId };

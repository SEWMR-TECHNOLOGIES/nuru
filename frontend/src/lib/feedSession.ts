export const FEED_SCROLL_KEY = "feedScrollPosition";
export const FEED_LAST_VISIT_KEY = "feedLastVisitedAt";

export const getFeedScrollContainer = (anchor?: HTMLElement | null): HTMLElement | Window => {
  let el: HTMLElement | null = anchor || null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-feed-scroll-container]"));
  const visible = candidates.find((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });

  return visible || window;
};

export const getFeedScrollTop = (container: HTMLElement | Window) => (
  container === window ? window.scrollY : (container as HTMLElement).scrollTop
);

export const setFeedScrollTop = (container: HTMLElement | Window, top: number) => {
  if (container === window) {
    window.scrollTo({ top, left: 0, behavior: "auto" });
  } else {
    (container as HTMLElement).scrollTop = top;
  }
};

export const getFeedMaxScroll = (container: HTMLElement | Window) => {
  if (container === window) {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollHeight - window.innerHeight);
  }
  const el = container as HTMLElement;
  return Math.max(0, el.scrollHeight - el.clientHeight);
};

export const saveFeedScrollPosition = (anchor?: HTMLElement | null) => {
  if (typeof window === "undefined") return;
  const container = getFeedScrollContainer(anchor);
  sessionStorage.setItem(FEED_SCROLL_KEY, String(getFeedScrollTop(container)));
  sessionStorage.setItem(FEED_LAST_VISIT_KEY, String(Date.now()));
};

export const readSavedFeedScrollPosition = () => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(FEED_SCROLL_KEY);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
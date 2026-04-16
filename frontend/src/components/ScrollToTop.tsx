// components/ScrollToTop.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const FEED_SCROLL_KEY = "feedScrollPosition";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/") {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};

export default ScrollToTop;

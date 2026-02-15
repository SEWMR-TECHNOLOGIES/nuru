import { ReactNode, useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import RightSidebar from "./RightSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuthSync } from "@/hooks/useAuthSync";

type LayoutProps = {
  children?: ReactNode;
};

const SCROLL_DELTA_THRESHOLD = 10; // px – ignore jitter below this

const Layout = ({ children }: LayoutProps) => {
  useAuthSync();
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  // Auto-hide header on mobile scroll (like Facebook) with dead-zone to prevent trembling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = container.scrollTop;
        const isMobile = window.innerWidth < 768;

        if (!isMobile) {
          setHeaderVisible(true);
          lastScrollY.current = currentY;
          accumulatedDelta.current = 0;
          ticking.current = false;
          return;
        }

        const delta = currentY - lastScrollY.current;
        // Accumulate delta in same direction, reset on direction change
        if ((delta > 0 && accumulatedDelta.current < 0) || (delta < 0 && accumulatedDelta.current > 0)) {
          accumulatedDelta.current = 0;
        }
        accumulatedDelta.current += delta;

        // Only toggle after accumulated scroll exceeds threshold
        if (accumulatedDelta.current > SCROLL_DELTA_THRESHOLD && currentY > 60) {
          setHeaderVisible(false);
          accumulatedDelta.current = 0;
        } else if (accumulatedDelta.current < -SCROLL_DELTA_THRESHOLD) {
          setHeaderVisible(true);
          accumulatedDelta.current = 0;
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="h-screen w-screen bg-background font-inter overflow-hidden px-2 md:px-0 lg:px-16">
      <div className="h-full bg-card rounded-lg overflow-hidden flex flex-col">
        {/* Header - slides up on mobile scroll using transform (GPU, no layout shift) */}
        <div
          className="h-16 md:h-16 transition-transform duration-300 ease-in-out will-change-transform"
          style={{
            transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
            marginBottom: headerVisible ? 0 : '-4rem',
          }}
        >
          <Header
            onMenuToggle={() => setLeftDrawerOpen(true)}
            onRightPanelToggle={() => setRightDrawerOpen(true)}
          />
        </div>

        {/* TopNav - always visible */}
        <TopNav />

        <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full">
          <div className="hidden md:block">
            <Sidebar />
          </div>

          <main className="flex-1 overflow-hidden">
            <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50/30">
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overscroll-y-contain px-3 md:px-4 lg:px-6 pt-4 pb-20 md:pb-8"
              >
                {children ?? <Outlet />}
              </div>
              <div className="hidden lg:block lg:w-80 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-20 lg:pb-8 border-l border-border">
                <RightSidebar />
              </div>
            </div>
          </main>
        </div>

        {/* Mobile Left Drawer (Sidebar) */}
        <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
          <SheetContent side="left" className="w-64 p-0 border-none">
            <div className="h-full overflow-y-auto overscroll-y-contain pt-12 pb-20">
              <Sidebar onNavigate={() => setLeftDrawerOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Right Drawer (Right Sidebar) */}
        <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
          <SheetContent side="right" className="w-80 p-0 border-none">
            <div className="h-full overflow-y-auto overscroll-y-contain p-4 pb-20 pt-12">
              <RightSidebar />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default Layout;

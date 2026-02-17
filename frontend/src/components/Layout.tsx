import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
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

const Layout = ({ children }: LayoutProps) => {
  useAuthSync();
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || window.innerWidth >= 768) return;

    const currentY = container.scrollTop;
    const delta = currentY - lastScrollY.current;

    // Near top: always show
    if (currentY < 50) {
      setHeaderHidden(false);
    }
    // Scrolling down by meaningful amount: hide
    else if (delta > 8) {
      setHeaderHidden(true);
    }
    // Scrolling up by meaningful amount: show
    else if (delta < -8) {
      setHeaderHidden(false);
    }

    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className="h-screen w-screen bg-background font-inter overflow-hidden px-2 md:px-0 lg:px-16">
      <div className="h-full bg-card rounded-lg overflow-hidden flex flex-col relative">
        {/* Header */}
        <div
          className={`
            md:relative md:translate-y-0
            absolute top-0 left-0 right-0 z-30 h-16
            transition-transform duration-300 ease-out
            ${headerHidden ? '-translate-y-full' : 'translate-y-0'}
          `}
        >
          <Header
            onMenuToggle={() => setLeftDrawerOpen(true)}
            onRightPanelToggle={() => setRightDrawerOpen(true)}
          />
        </div>

        {/* Spacer for header on mobile only - collapses when header is hidden */}
        <div
          className={`md:hidden transition-[height] duration-300 ease-out ${headerHidden ? 'h-0' : 'h-16'}`}
        />

        {/* TopNav - always visible, never moves */}
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

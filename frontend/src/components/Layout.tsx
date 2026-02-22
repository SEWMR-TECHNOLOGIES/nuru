import { ReactNode, useState } from "react";
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

  return (
    <div className="h-screen w-screen bg-background font-nunito overflow-hidden px-2 md:px-0 tablet:px-0 lg:px-16">
      <div className="h-full bg-card rounded-lg flex flex-col relative md:overflow-hidden">
        {/* Scrollable wrapper on mobile: header + topnav + content all scroll together */}
        <div className="flex-1 flex flex-col md:contents overflow-y-auto overscroll-y-contain">
          {/* Header scrolls away naturally on mobile */}
          <div className="shrink-0">
            <Header
              onMenuToggle={() => setLeftDrawerOpen(true)}
              onRightPanelToggle={() => setRightDrawerOpen(true)}
            />
          </div>

          {/* TopNav sticks to top on mobile after header scrolls away */}
          <div className="sticky top-0 z-20 shrink-0">
            <TopNav />
          </div>

          <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full">
            <div className="hidden md:block">
              <Sidebar />
            </div>

            <main className="flex-1 md:overflow-hidden">
              <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50/30">
                <div className="flex-1 md:overflow-y-auto md:overscroll-y-contain px-3 md:px-4 lg:px-6 pt-4 pb-20 md:pb-8">
                  {children ?? <Outlet />}
                </div>
                <div className="hidden lg:block lg:w-80 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-20 lg:pb-8 border-l border-border">
                  <RightSidebar />
                </div>
              </div>
            </main>
          </div>
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

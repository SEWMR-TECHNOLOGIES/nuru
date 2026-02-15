import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import RightSidebar from "./RightSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuthSync } from "@/hooks/useAuthSync";

type LayoutProps = {
  /**
   * When provided, Layout renders these children instead of <Outlet />.
   * Useful for the root "/" route which needs to conditionally show Feed vs Landing.
   */
  children?: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  useAuthSync();
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-background font-inter overflow-hidden px-2 md:px-0 lg:px-16">
      <div className="h-full bg-card rounded-lg overflow-hidden">
        <Header
          onMenuToggle={() => setLeftDrawerOpen(true)}
          onRightPanelToggle={() => setRightDrawerOpen(true)}
        />
        <TopNav />

        <div className="flex flex-col md:flex-row h-[calc(100%-6.5rem)] w-full">
          <div className="hidden md:block">
            <Sidebar />
          </div>

          <main className="flex-1 overflow-hidden">
            <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50/30">
              <div className="flex-1 overflow-y-auto overscroll-y-contain px-3 md:px-4 lg:px-6 pt-4 pb-20 md:pb-8">
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

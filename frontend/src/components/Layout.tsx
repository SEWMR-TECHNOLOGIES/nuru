import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
import { Outlet } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const Layout = () => {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-background font-inter overflow-hidden px-2 md:px-4 lg:px-16">
      <div className="h-full bg-card rounded-lg overflow-hidden">
        <Header 
          onMenuToggle={() => setLeftDrawerOpen(true)}
          onRightPanelToggle={() => setRightDrawerOpen(true)}
        />
        <div className="flex flex-col md:flex-row h-[calc(100%-4rem)] w-full">
          <div className="hidden md:block">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-hidden">
            <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50/30">
              <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
                <Outlet />
              </div>
              <div className="hidden lg:block lg:w-80 overflow-y-auto px-4 py-4 border-l border-border">
                <RightSidebar />
              </div>
            </div>
          </main>
        </div>

        {/* Mobile Left Drawer (Sidebar) */}
        <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
          <SheetContent side="left" className="w-64 p-0 border-none">
            <div className="h-full overflow-y-auto p-2">
              <Sidebar onNavigate={() => setLeftDrawerOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Right Drawer (Right Sidebar) */}
        <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <RightSidebar />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default Layout;
import { ReactNode, useState, useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import RightSidebar from "./RightSidebar";
import MobileOnboarding, { type MobileOnboardingRef } from "./MobileOnboarding";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuthSync } from "@/hooks/useAuthSync";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SuspensionModal from "./SuspensionModal";

type LayoutProps = {
  children?: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  useAuthSync();
  const { data: currentUser } = useCurrentUser();
  const onboardingRef = useRef<MobileOnboardingRef>(null);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [suspensionDismissed, setSuspensionDismissed] = useState(false);

  const isSuspended = currentUser?.is_suspended;
  const showSuspensionModal = isSuspended && !suspensionDismissed;

  const openLeft = useCallback(() => setLeftDrawerOpen(true), []);
  const closeLeft = useCallback(() => setLeftDrawerOpen(false), []);
  const openRight = useCallback(() => setRightDrawerOpen(true), []);
  const closeRight = useCallback(() => setRightDrawerOpen(false), []);

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
              <Sidebar onReplayTour={() => onboardingRef.current?.replay()} />
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
              <Sidebar onNavigate={() => setLeftDrawerOpen(false)} onReplayTour={() => { setLeftDrawerOpen(false); setTimeout(() => onboardingRef.current?.replay(), 400); }} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Right Drawer (Right Sidebar) */}
        <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
          <SheetContent side="right" className="w-80 p-0 border-none">
            <div className="h-full overflow-y-auto overscroll-y-contain p-4 pb-20 pt-12">
              <RightSidebar onNavigate={() => setRightDrawerOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Onboarding Guide */}
        <MobileOnboarding
          ref={onboardingRef}
          onOpenLeft={openLeft}
          onCloseLeft={closeLeft}
          onOpenRight={openRight}
          onCloseRight={closeRight}
        />

        {/* Read-only overlay: blocks all clicks/interactions when suspended */}
        {isSuspended && suspensionDismissed && (
          <div
            className="absolute inset-0 z-40"
            style={{ pointerEvents: "auto" }}
            onClickCapture={(e) => {
              // Allow clicking the banner buttons only
              if ((e.target as HTMLElement).closest("[data-suspension-banner]")) return;
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {/* Floating banner reminding user they're in read-only mode */}
            <div
              data-suspension-banner
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              Read-only mode — Account suspended
              <button
                onClick={() => setSuspensionDismissed(false)}
                className="ml-2 underline underline-offset-2 hover:opacity-80 text-xs"
              >
                Details
              </button>
            </div>
          </div>
        )}

        <SuspensionModal
          open={!!showSuspensionModal}
          reason={currentUser?.suspension_reason}
          onClose={() => setSuspensionDismissed(true)}
        />
      </div>
    </div>
  );
};

export default Layout;

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import SvgIcon from '@/components/ui/svg-icon';
import MenuIcon from '@/assets/icons/menu-icon.svg';
import PanelRightIcon from '@/assets/icons/panel-right-icon.svg';
import { PanelLeft, PanelRight } from 'lucide-react';

const ONBOARDING_KEY = 'nuru_onboarding_seen';

export interface MobileOnboardingRef {
  replay: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: string;
  iconAlt: string;
  action: 'open-left' | 'open-right';
  position: 'left' | 'right';
}

const steps: Step[] = [
  {
    title: 'Navigation Menu',
    description: 'Tap here to access your navigation, profile links, and more.',
    icon: MenuIcon,
    iconAlt: 'Menu',
    action: 'open-left',
    position: 'left',
  },
  {
    title: 'Quick Panel',
    description: 'Tap here to view trending topics, suggestions, and updates.',
    icon: PanelRightIcon,
    iconAlt: 'Panel',
    action: 'open-right',
    position: 'right',
  },
];

interface MobileOnboardingProps {
  onOpenLeft: () => void;
  onCloseLeft: () => void;
  onOpenRight: () => void;
  onCloseRight: () => void;
}

const MobileOnboarding = forwardRef<MobileOnboardingRef, MobileOnboardingProps>(({
  onOpenLeft,
  onCloseLeft,
  onOpenRight,
  onCloseRight,
}, ref) => {
  const isMobile = useIsMobile();
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'highlight' | 'demo' | 'outro'>('intro');

  useImperativeHandle(ref, () => ({
    replay: () => {
      setCurrentStep(0);
      setPhase('intro');
      setActive(true);
    },
  }));



  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      const timer = setTimeout(() => setActive(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeDrawers = useCallback(() => {
    onCloseLeft();
    onCloseRight();
  }, [onCloseLeft, onCloseRight]);

  const runStep = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
    setPhase('highlight');

    // After highlighting, open the drawer
    setTimeout(() => {
      setPhase('demo');
      if (steps[stepIndex].action === 'open-left') {
        onOpenLeft();
      } else {
        onOpenRight();
      }
    }, 2200);

    // Close the drawer
    setTimeout(() => {
      closeDrawers();
    }, 5000);

    // Move to next step or finish
    setTimeout(() => {
      if (stepIndex < steps.length - 1) {
        runStep(stepIndex + 1);
      } else {
        setPhase('outro');
        setTimeout(() => {
          setActive(false);
          localStorage.setItem(ONBOARDING_KEY, 'true');
        }, 3000);
      }
    }, 6500);
  }, [onOpenLeft, onOpenRight, closeDrawers]);

  const handleStart = () => {
    setPhase('highlight');
    runStep(0);
  };

  const handleSkip = () => {
    closeDrawers();
    setActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  if (!active) return null;

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] pointer-events-auto"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center px-6">
            <AnimatePresence mode="wait">
              {phase === 'intro' && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center max-w-xs"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6"
                  >
                    <span className="text-3xl">✨</span>
                  </motion.div>
                  <h2 className="text-xl font-bold text-white mb-2">Quick Tour</h2>
                  <p className="text-white/70 text-sm mb-8 leading-relaxed">
                    Let us show you around. It'll only take a moment.
                  </p>
                  <div className="flex flex-col gap-3 w-full">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStart}
                      className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide"
                    >
                      Show me
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSkip}
                      className="w-full py-3 rounded-full text-white/50 text-sm"
                    >
                      Skip
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {(phase === 'highlight' || phase === 'demo') && (
                <motion.div
                  key={`step-${currentStep}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center max-w-xs"
                >
                  {/* Pointer arrow - mobile only */}
                  {isMobile && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, y: [0, -8, 0] }}
                      transition={{
                        opacity: { duration: 0.3 },
                        y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                      }}
                      className={`absolute top-4 ${step.position === 'left' ? 'left-6' : 'right-6'}`}
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center">
                          <SvgIcon src={step.icon} alt={step.iconAlt} className="w-5 h-5 invert" />
                        </div>
                        <svg width="20" height="24" viewBox="0 0 20 24" className="mt-1 text-white/60">
                          <path d="M10 0 L10 18 M4 12 L10 18 L16 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </motion.div>
                  )}

                  {/* Desktop panel highlight */}
                  {!isMobile && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className={`fixed top-0 bottom-0 z-[101] pointer-events-none ${
                        step.position === 'left' ? 'left-0' : 'right-0'
                      }`}
                    >
                      <div className={`h-full ${step.position === 'left' ? 'w-64' : 'w-80'} border-2 border-white/40 rounded-lg`}>
                        <motion.div
                          animate={{ opacity: [0.05, 0.15, 0.05] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="h-full w-full rounded-lg bg-white/10"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Step info */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-5"
                  >
                    {!isMobile ? (
                      step.position === 'left' ? <PanelLeft className="w-6 h-6 text-white" /> : <PanelRight className="w-6 h-6 text-white" />
                    ) : (
                      <SvgIcon src={step.icon} alt={step.iconAlt} className="w-6 h-6 invert" />
                    )}
                  </motion.div>
                  <h3 className="text-lg font-bold text-white mb-1.5">{step.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{step.description}</p>

                  {/* Step indicator */}
                  <div className="flex gap-2 mt-8">
                    {steps.map((_, i) => (
                      <motion.div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          i === currentStep ? 'w-6 bg-white' : 'w-1.5 bg-white/30'
                        }`}
                      />
                    ))}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSkip}
                    className="mt-6 text-white/40 text-xs"
                  >
                    Skip tour
                  </motion.button>
                </motion.div>
              )}

              {phase === 'outro' && (
                <motion.div
                  key="outro"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="text-4xl mb-4"
                  >
                    🎉
                  </motion.span>
                  <h3 className="text-lg font-bold text-white mb-1">You're all set!</h3>
                  <p className="text-white/60 text-sm">Enjoy exploring Nuru.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

MobileOnboarding.displayName = 'MobileOnboarding';

export default MobileOnboarding;

import { useState, useEffect } from "react";

interface CountdownClockProps {
  targetDate: string;
  compact?: boolean;
}

const CountdownClock = ({ targetDate, compact = false }: CountdownClockProps) => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.isPast) {
    return (
      <span className="text-[9px] text-muted-foreground font-medium">Event passed</span>
    );
  }

  if (timeLeft.isToday) {
    return (
      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">🎉 Today!</span>
    );
  }

  if (timeLeft.isTomorrow) {
    return (
      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Tomorrow</span>
    );
  }

  const segments = [
    { value: timeLeft.months, label: "M" },
    { value: timeLeft.days, label: "D" },
    { value: timeLeft.hours, label: "H" },
    { value: timeLeft.minutes, label: "M" },
    { value: timeLeft.seconds, label: "S" },
  ];

  // Skip leading zero months
  const startIdx = timeLeft.months > 0 ? 0 : 1;
  const displaySegments = segments.slice(startIdx);

  return (
    <div className="flex items-center gap-[3px]">
      {displaySegments.map((seg, i) => (
        <div key={i} className="flex items-center gap-[3px]">
          <div className={`flex flex-col items-center ${compact ? 'min-w-[20px]' : 'min-w-[24px]'}`}>
            <span className={`font-mono font-bold leading-none text-primary ${compact ? 'text-[11px]' : 'text-xs'}`}>
              {String(seg.value).padStart(2, "0")}
            </span>
            <span className="text-[6px] uppercase tracking-wider text-muted-foreground font-semibold mt-[1px]">
              {seg.label}
            </span>
          </div>
          {i < displaySegments.length - 1 && (
            <span className="text-[8px] text-muted-foreground/50 font-bold leading-none mb-2">:</span>
          )}
        </div>
      ))}
    </div>
  );
};

function getTimeLeft(targetDate: string) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDiff = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff < 0) return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isToday: false, isTomorrow: false };
  if (dayDiff === 0) return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isToday: true, isTomorrow: false };
  if (dayDiff === 1) return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isToday: false, isTomorrow: true };

  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const months = Math.floor(totalSeconds / (30 * 24 * 3600));
  const remaining1 = totalSeconds % (30 * 24 * 3600);
  const days = Math.floor(remaining1 / (24 * 3600));
  const remaining2 = remaining1 % (24 * 3600);
  const hours = Math.floor(remaining2 / 3600);
  const remaining3 = remaining2 % 3600;
  const minutes = Math.floor(remaining3 / 60);
  const seconds = remaining3 % 60;

  return { months, days, hours, minutes, seconds, isPast: false, isToday: false, isTomorrow: false };
}

export default CountdownClock;

import { forwardRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Calendar, Clock, MapPin, User, Ticket, Gift, Users, Heart, Shield } from 'lucide-react';
import nuruLogo from '@/assets/nuru-logo.png';

/* Pure-SVG decorative panel — no raster images.
   Renders an abstract elegant scene: warm gradient backdrop,
   silhouette figures, sparkles and floral flourishes. */
const DecoPanel = ({ tone = 'warm' }: { tone?: 'warm' | 'cream' }) => {
  const stops =
    tone === 'warm'
      ? { a: '#3a2410', b: '#7a4a1c', c: '#d89a3a', d: '#f6c97a' }
      : { a: '#6a4418', b: '#b07a30', c: '#e6b85a', d: '#fbe3a8' };
  return (
    <svg viewBox="0 0 300 840" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
      <defs>
        <linearGradient id={`bg-${tone}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={stops.a} />
          <stop offset="55%" stopColor={stops.b} />
          <stop offset="100%" stopColor={stops.c} />
        </linearGradient>
        <radialGradient id={`glow-${tone}`} cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor={stops.d} stopOpacity="0.55" />
          <stop offset="100%" stopColor={stops.d} stopOpacity="0" />
        </radialGradient>
        <pattern id={`dots-${tone}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.7" fill={stops.d} fillOpacity="0.25" />
        </pattern>
      </defs>

      <rect width="300" height="840" fill={`url(#bg-${tone})`} />
      <rect width="300" height="840" fill={`url(#glow-${tone})`} />
      <rect width="300" height="840" fill={`url(#dots-${tone})`} />

      {/* Abstract arch / sun */}
      <circle cx="150" cy="300" r="140" fill={stops.d} fillOpacity="0.12" />
      <circle cx="150" cy="300" r="90" fill={stops.d} fillOpacity="0.18" />

      {/* Silhouette figures (couple) */}
      <g fill="#1a0e06" fillOpacity="0.85">
        <ellipse cx="120" cy="430" rx="22" ry="26" />
        <path d="M82 700 Q82 520 120 460 Q158 520 158 700 Z" />
        <ellipse cx="186" cy="420" rx="24" ry="28" />
        <path d="M142 720 Q146 530 186 455 Q230 530 230 720 Z" />
      </g>

      {/* Floral flourish bottom */}
      <g stroke={stops.d} strokeOpacity="0.5" strokeWidth="1" fill="none">
        <path d="M20 760 Q80 720 150 760 T 280 760" />
        <path d="M20 790 Q80 760 150 790 T 280 790" />
      </g>
      <g fill={stops.d} fillOpacity="0.55">
        {[40, 90, 150, 210, 260].map((x, i) => (
          <circle key={i} cx={x} cy={760} r="2.5" />
        ))}
      </g>

      {/* Sparkles */}
      <g fill={stops.d}>
        {[
          [40, 80], [250, 110], [60, 200], [240, 240], [30, 360],
          [260, 380], [50, 540], [255, 580], [80, 660], [220, 690],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fillOpacity="0.7" />
          </g>
        ))}
      </g>
    </svg>
  );
};

export type NuruCardVariant = 'classic' | 'editorial';

export interface NuruCardData {
  guestName?: string;
  eventTitle: string;
  date: string;          // formatted date e.g. "SAT, 24 MAY 2025"
  time: string;          // e.g. "6:00 PM – 10:00 PM"
  venue: string;         // e.g. "DAR ES SALAAM, TANZANIA"
  organizer?: string;    // org / host name
  description?: string;  // quote / message
  dressCode?: string;
  admits?: string;       // e.g. "1 Guest"
  qrValue: string;
  qrUrl?: string;        // shown under "or visit"
}

interface Props {
  variant: NuruCardVariant;
  data: NuruCardData;
}

/* ---------- shared sub-components ---------- */

const BrandLogo = ({ size = 64 }: { size?: number }) => (
  <div className="flex flex-col items-start gap-1">
    <img src={nuruLogo} alt="Nuru" style={{ height: size, width: 'auto' }} className="object-contain" />
    <p className="text-[11px] tracking-wide font-medium text-neutral-800">
      Plan <span className="text-amber-500">Smarter</span>. Celebrate <span className="text-amber-500">Better</span>.
    </p>
  </div>
);

const Divider = () => (
  <div className="flex items-center justify-center gap-2 my-2">
    <span className="h-px w-12 bg-amber-400" />
    <span className="text-amber-500 text-lg leading-none">✦</span>
    <span className="h-px w-12 bg-amber-400" />
  </div>
);

const TogetherBadge = ({ className = '' }: { className?: string }) => (
  <div
    className={`w-[110px] h-[110px] rounded-full bg-white border-2 border-amber-400 flex flex-col items-center justify-center text-center shadow-md ${className}`}
  >
    <Users className="w-5 h-5 text-amber-500 mb-0.5" strokeWidth={1.5} />
    <p className="text-[8px] font-semibold tracking-wider text-neutral-700 leading-tight">
      TOGETHER<br />WE CREATE
    </p>
    <p className="text-[8px] font-bold tracking-wider text-amber-500 mt-0.5">MEMORIES</p>
    <Heart className="w-3 h-3 text-amber-500 mt-0.5" strokeWidth={2} fill="currentColor" />
  </div>
);

const FooterStrip = ({ qrValue, qrUrl, admits, dressCode }: {
  qrValue: string; qrUrl?: string; admits?: string; dressCode?: string;
}) => (
  <div className="relative z-30 bg-neutral-900 rounded-2xl mx-4 mb-3 px-4 py-3 grid grid-cols-[auto_1fr_1fr] gap-3 items-center text-white">
    {/* QR */}
    <div className="flex items-center gap-2">
      <div className="bg-white p-1.5 rounded-md border-2 border-amber-400">
        <QRCodeCanvas value={qrValue} size={56} level="H" includeMargin={false} />
      </div>
      <div className="leading-tight min-w-0">
        <p className="text-[9px] font-bold tracking-wider text-amber-400">SCAN TO RSVP</p>
        <p className="text-[8px] text-neutral-300 mt-0.5">or visit</p>
        <p className="text-[8px] text-neutral-300 break-all leading-tight max-w-[110px]">{qrUrl || 'nuru.tz/rsvp'}</p>
      </div>
    </div>
    {/* Admits */}
    <div className="flex items-center gap-2 justify-center min-w-0">
      <Ticket className="w-6 h-6 text-amber-400 flex-shrink-0" strokeWidth={1.5} />
      <div className="leading-tight min-w-0">
        <p className="text-[9px] font-bold tracking-wider text-amber-400">INVITE ADMITS</p>
        <p className="text-[10px] text-neutral-200 mt-0.5 break-words leading-tight">{admits || '1 Guest'}</p>
      </div>
    </div>
    {/* Dress code */}
    <div className="flex items-center gap-2 justify-center min-w-0">
      <Gift className="w-6 h-6 text-amber-400 flex-shrink-0" strokeWidth={1.5} />
      <div className="leading-tight min-w-0">
        <p className="text-[9px] font-bold tracking-wider text-amber-400">DRESS CODE</p>
        <p className="text-[9px] text-neutral-200 mt-0.5 leading-tight line-clamp-2">{dressCode || 'As you feel comfortable'}</p>
      </div>
    </div>
  </div>
);

const TrustRow = () => (
  <div className="relative z-30 flex items-center justify-center gap-4 pb-3 pt-1 text-[10px] text-neutral-500 bg-white">
    <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-amber-500" /> Trusted.</span>
    <span className="text-neutral-300">|</span>
    <span className="flex items-center gap-1"><Users className="w-3 h-3 text-amber-500" /> Connected.</span>
    <span className="text-neutral-300">|</span>
    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-amber-500" /> Memorable.</span>
  </div>
);

/* ---------- VARIANT 1 — Classic (photo right, curved) ---------- */

const ClassicCard = ({ data }: { data: NuruCardData }) => (
  <div className="relative w-[600px] bg-white" style={{ aspectRatio: '600/840' }}>
    {/* Right decorative panel — bounded so it doesn't overlap the footer */}
    <div
      className="absolute top-0 right-0 w-[42%] overflow-hidden"
      style={{
        height: 'calc(100% - 150px)',
        clipPath: 'path("M 60 0 Q 0 200 30 360 Q 60 540 80 690 L 252 690 L 252 0 Z")',
      }}
    >
      <DecoPanel tone="warm" />
    </div>

    {/* Top gold ribbon */}
    <div className="absolute top-0 right-[18%] w-6 h-24 bg-gradient-to-b from-amber-400 to-amber-500" />
    <div
      className="absolute top-24 right-[18%] w-6 h-4 bg-amber-500"
      style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
    />

    {/* Together badge over ribbon */}
    <div className="absolute top-20 right-[10%] z-10">
      <TogetherBadge />
    </div>

    {/* Header */}
    <div className="relative pt-6 pl-8 pr-[45%]">
      <BrandLogo size={56} />
    </div>

    {/* "You're invited" block */}
    <div className="relative pl-8 pr-[45%] mt-6">
      <p className="text-[13px] tracking-[0.4em] text-neutral-700 font-medium">YOU'RE</p>
      <h1
        className="text-[88px] leading-[0.9] text-amber-500 -mt-1"
        style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive', fontWeight: 400 }}
      >
        Invited
      </h1>
      <div className="flex items-center gap-2 mt-2">
        <p className="text-[11px] tracking-[0.4em] text-neutral-700">TO</p>
        <span className="h-px w-6 bg-amber-400" />
      </div>
      <p className="text-[12px] tracking-[0.25em] text-neutral-800 font-medium mt-2">
        AN EXTRAORDINARY EXPERIENCE
      </p>
      <Divider />
    </div>

    {/* Event card panel */}
    <div className="relative mx-6 mt-4 bg-white border border-amber-100 rounded-2xl shadow-sm pt-6 pb-5 px-5">
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center shadow">
        <Calendar className="w-5 h-5 text-white" strokeWidth={2} />
      </div>

      {data.guestName && (
        <p className="text-center text-[11px] tracking-[0.3em] text-neutral-500 mt-1">
          DEAR <span className="text-amber-600 font-semibold">{data.guestName.toUpperCase()}</span>
        </p>
      )}

      <p className="text-center text-[10px] tracking-[0.4em] text-amber-500 font-semibold mt-1">EVENT NAME</p>
      <h2
        className="text-center text-[34px] leading-tight font-bold text-neutral-900 mt-1 break-words"
        style={{ fontFamily: '"Playfair Display", "Times New Roman", serif' }}
      >
        {data.eventTitle.toUpperCase()}
      </h2>
      <Divider />

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[
          { Icon: Calendar, label: 'DATE', value: data.date },
          { Icon: Clock, label: 'TIME', value: data.time },
          { Icon: MapPin, label: 'VENUE', value: data.venue },
        ].map(({ Icon, label, value }, i) => (
          <div key={i} className={i > 0 ? 'border-l border-amber-100 px-1' : 'px-1'}>
            <Icon className="w-5 h-5 text-amber-500 mx-auto" strokeWidth={1.5} />
            <p className="text-[10px] tracking-[0.2em] font-bold text-neutral-800 mt-1">{label}</p>
            <p className="text-[10px] text-amber-600 font-medium mt-1 leading-tight">{value || '—'}</p>
          </div>
        ))}
      </div>

      {data.description && (
        <div className="mt-4 px-2">
          <span className="text-amber-400 text-2xl leading-none">“</span>
          <p className="text-center text-[12px] text-neutral-700 italic leading-relaxed -mt-2 px-2">
            {data.description}
          </p>
          <p className="text-right text-amber-400 text-2xl leading-none -mt-1">”</p>
        </div>
      )}

      {data.organizer && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-amber-50">
          <div className="w-9 h-9 rounded-full border-2 border-amber-300 flex items-center justify-center">
            <User className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] tracking-[0.3em] text-neutral-500 font-semibold">ORGANIZED BY</p>
            <p className="text-[12px] text-amber-600 font-semibold mt-0.5">{data.organizer}</p>
          </div>
        </div>
      )}
    </div>

    <div className="h-3" />
    <FooterStrip qrValue={data.qrValue} qrUrl={data.qrUrl} admits={data.admits} dressCode={data.dressCode} />
    <TrustRow />
  </div>
);

/* ---------- VARIANT 2 — Editorial (photo left, curved) ---------- */

const EditorialCard = ({ data }: { data: NuruCardData }) => (
  <div className="relative w-[600px] bg-[#fdfaf3]" style={{ aspectRatio: '600/840' }}>
    {/* Left decorative panel — bounded so it doesn't overlap the footer */}
    <div
      className="absolute top-0 left-0 w-[44%] overflow-hidden"
      style={{
        height: 'calc(100% - 150px)',
        clipPath: 'path("M 0 0 L 220 0 Q 280 200 240 360 Q 200 560 220 690 L 0 690 Z")',
      }}
    >
      <DecoPanel tone="cream" />
    </div>

    {/* "You're Invited" overlay on photo */}
    <div className="absolute top-16 left-6 w-[40%] z-10">
      <p
        className="text-[28px] text-amber-400 leading-none"
        style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive' }}
      >
        You're
      </p>
      <h1
        className="text-[64px] text-white leading-[0.95] -mt-1 drop-shadow-md"
        style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive' }}
      >
        Invited
      </h1>
      <div className="flex items-center gap-2 mt-1">
        <span className="h-px w-12 bg-amber-400" />
        <Heart className="w-3 h-3 text-amber-400" fill="currentColor" />
      </div>
      <p className="text-white text-[12px] mt-6 leading-relaxed drop-shadow">
        Great events<br />
        bring people together.<br />
        Lasting memories<br />
        keep us connected.
      </p>
    </div>

    {/* Together badge floating on the curve */}
    <div className="absolute top-[42%] left-[34%] z-20">
      <TogetherBadge />
    </div>

    {/* Right side content */}
    <div className="relative ml-[46%] pr-6 pt-6">
      <div className="flex justify-end">
        <BrandLogo size={48} />
      </div>

      <div className="mt-8 text-center">
        <p className="text-[11px] tracking-[0.4em] text-neutral-700 font-medium">JOIN US FOR</p>
        <Divider />
        <h2
          className="text-[32px] leading-tight font-bold text-neutral-900 mt-2 break-words"
          style={{ fontFamily: '"Playfair Display", "Times New Roman", serif' }}
        >
          {data.eventTitle.toUpperCase()}
        </h2>
        <p className="text-[10px] tracking-[0.3em] text-neutral-600 mt-3 font-medium">
          A SPECIAL OCCASION WORTH CELEBRATING
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="h-px w-10 bg-amber-300" />
          <Heart className="w-2.5 h-2.5 text-amber-400" fill="currentColor" />
          <span className="h-px w-10 bg-amber-300" />
        </div>

        {data.guestName && (
          <p className="text-[11px] tracking-[0.3em] text-neutral-500 mt-3">
            DEAR <span className="text-amber-600 font-semibold">{data.guestName.toUpperCase()}</span>
          </p>
        )}
      </div>

      {/* Date / Time / Venue in cards */}
      <div className="grid grid-cols-3 gap-2 mt-5">
        {[
          { Icon: Calendar, label: 'DATE', value: data.date },
          { Icon: Clock, label: 'TIME', value: data.time },
          { Icon: MapPin, label: 'VENUE', value: data.venue },
        ].map(({ Icon, label, value }, i) => (
          <div key={i} className="border border-amber-200 rounded-xl py-3 px-1 text-center bg-white/60">
            <Icon className="w-5 h-5 text-amber-500 mx-auto" strokeWidth={1.5} />
            <p className="text-[10px] tracking-[0.2em] font-bold text-neutral-800 mt-1">{label}</p>
            <p className="text-[9px] text-amber-600 font-medium mt-1 leading-tight px-0.5">
              {value || '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Quote */}
      {data.description && (
        <div className="mt-4 bg-white/70 border border-amber-100 rounded-xl px-3 py-3">
          <p className="text-amber-400 text-xl leading-none">“</p>
          <p className="text-center text-[11px] text-neutral-700 italic leading-relaxed px-1">
            {data.description}
          </p>
          <p className="text-right text-amber-400 text-xl leading-none">”</p>
        </div>
      )}

      {/* Organizer */}
      {data.organizer && (
        <div className="flex items-center gap-3 mt-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-300 flex items-center justify-center">
            <User className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] tracking-[0.3em] text-neutral-500 font-semibold">ORGANIZED BY</p>
            <p className="text-[12px] text-amber-600 font-semibold mt-0.5">{data.organizer}</p>
          </div>
        </div>
      )}
    </div>

    <div className="h-4" />
    <FooterStrip qrValue={data.qrValue} qrUrl={data.qrUrl} admits={data.admits} dressCode={data.dressCode} />
    <TrustRow />
  </div>
);

/* ---------- exported card ---------- */

const NuruInvitationCard = forwardRef<HTMLDivElement, Props>(({ variant, data }, ref) => {
  return (
    <div ref={ref} className="bg-white">
      {variant === 'editorial' ? <EditorialCard data={data} /> : <ClassicCard data={data} />}
    </div>
  );
});

NuruInvitationCard.displayName = 'NuruInvitationCard';

export default NuruInvitationCard;

import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import PrintIcon from '@/assets/icons/print-icon.svg';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

interface ThemeConfig {
  accent: string;
  accentLight: string;
  bg: string;
  cardBg: string;
  label: string;
  font: string;
  textColor: string;
  detailColor: string;
}

const THEMES: Record<string, ThemeConfig> = {
  wedding: {
    accent: '#B8956A', accentLight: '#F0E6D3', bg: '#FAF7F2', cardBg: '#FFFDF8',
    label: 'You are cordially invited', font: "'Cormorant Garamond', Georgia, serif",
    textColor: '#2C2418', detailColor: '#5C4F3D',
  },
  birthday: {
    accent: '#E8446D', accentLight: '#FDE8EC', bg: '#FFF5F7', cardBg: '#FFFBFC',
    label: "You're invited to celebrate", font: "'Nunito', 'Inter', sans-serif",
    textColor: '#1A1A2E', detailColor: '#555',
  },
  corporate: {
    accent: '#3B82F6', accentLight: '#DBEAFE', bg: '#0F172A', cardBg: '#0F172A',
    label: 'You are invited', font: "'Inter', system-ui, sans-serif",
    textColor: '#F1F5F9', detailColor: '#94A3B8',
  },
  memorial: {
    accent: '#78716C', accentLight: '#E7E5E4', bg: '#FAFAF9', cardBg: '#FAFAF9',
    label: 'In loving memory', font: "'Cormorant Garamond', Georgia, serif",
    textColor: '#292524', detailColor: '#78716C',
  },
  anniversary: {
    accent: '#D97706', accentLight: '#FEF3C7', bg: '#FFFCF0', cardBg: '#FFFCF0',
    label: 'Join us in celebrating', font: "'Cormorant Garamond', Georgia, serif",
    textColor: '#1C1917', detailColor: '#57534E',
  },
  conference: {
    accent: '#8B5CF6', accentLight: '#EDE9FE', bg: '#FAF5FF', cardBg: '#FAF5FF',
    label: 'You are invited to attend', font: "'Inter', system-ui, sans-serif",
    textColor: '#1E1B4B', detailColor: '#6B7280',
  },
  graduation: {
    accent: '#059669', accentLight: '#D1FAE5', bg: '#F0FDF4', cardBg: '#F0FDF4',
    label: 'You are invited to celebrate', font: "'Nunito', 'Inter', sans-serif",
    textColor: '#064E3B', detailColor: '#4B5563',
  },
};

/* Robust type key matching — handles "Baby Shower", "baby_shower", "WEDDING", etc. */
const normalizeTypeKey = (eventType?: string): string => {
  if (!eventType) return 'wedding';
  const raw = eventType.toLowerCase().replace(/[\s_-]+/g, '');
  // Direct match
  if (THEMES[raw]) return raw;
  // Partial / fuzzy match
  for (const key of Object.keys(THEMES)) {
    if (raw.includes(key) || key.includes(raw)) return key;
  }
  return 'wedding';
};

const getTheme = (eventType?: string): ThemeConfig => THEMES[normalizeTypeKey(eventType)];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const rsvpLabel = (status: string) => {
  if (status === 'confirmed') return { label: 'CONFIRMED', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
  if (status === 'declined') return { label: 'DECLINED', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' };
  return { label: 'PENDING', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' };
};


const InvitationCard = ({ eventId, open, onClose }: InvitationCardProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setError(null);
    eventsApi.getInvitationCard(eventId)
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.message || 'Failed to load invitation');
      })
      .catch(() => setError('Failed to load invitation card'))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const buildQrValue = () => {
    if (data?.guest?.attendee_id)
      return `https://nuru.tz/event/${data.event?.id}/checkin/${data.guest.attendee_id}`;
    if (data?.invitation_code)
      return `https://nuru.tz/event/${data.event?.id}/rsvp/${data.invitation_code}`;
    return `https://nuru.tz/event/${data?.event?.id}`;
  };

  const getQrDataUrl = useCallback((): string => {
    if (!qrCanvasRef.current) return '';
    const canvas = qrCanvasRef.current.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : '';
  }, []);

  const theme = getTheme(data?.event?.event_type);
  const typeKey = normalizeTypeKey(data?.event?.event_type);
  /* ── Shared detail blocks ── */
  const DetailRow = ({ text, primary }: { text: string; primary?: boolean }) => (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: primary ? 14 : 13, fontWeight: primary ? 500 : 400, color: primary ? theme.textColor : theme.detailColor }}>
        {text}
      </span>
    </div>
  );

  const Details = () => (
    <div style={{ textAlign: 'center' }}>
      {data?.event?.start_date && <DetailRow text={formatDate(data.event.start_date)} primary />}
      {data?.event?.start_time && <DetailRow text={data.event.start_time} />}
      {(data?.event?.venue || data?.event?.location) && <DetailRow text={data.event.venue || data.event.location} />}
      {data?.event?.dress_code && (
        <span style={{
          display: 'inline-block', marginTop: 8, padding: '5px 18px', borderRadius: 100,
          fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const,
          color: theme.accent, background: theme.accentLight, border: `1px solid ${theme.accent}22`,
        }}>
          {data.event.dress_code}
        </span>
      )}
    </div>
  );

  const QrBlock = ({ dark }: { dark?: boolean }) => (
    <div style={{ textAlign: 'center', marginTop: 24 }}>
      <div style={{
        display: 'inline-block', padding: 10, borderRadius: 10,
        background: dark ? 'rgba(255,255,255,0.08)' : '#FAFAF8',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#F0EDE8'}`,
      }}>
        <QRCodeCanvas value={buildQrValue()} size={72} level="H" includeMargin={false}
          fgColor={dark ? '#E2E8F0' : '#1A1A1A'} bgColor="transparent" />
      </div>
      <p style={{
        fontSize: 8, color: theme.accent, marginTop: 8,
        letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 500, opacity: 0.6,
      }}>Scan to check in</p>
    </div>
  );

  const GuestBlock = ({ borderColor }: { borderColor?: string }) => {
    if (!data?.guest?.name) return null;
    const rsvp = data.guest.rsvp_status ? rsvpLabel(data.guest.rsvp_status) : null;
    return (
      <div style={{
        textAlign: 'center', margin: '24px 36px 0', paddingTop: 20,
        borderTop: `1px solid ${borderColor || theme.accentLight}`,
      }}>
        <p style={{ fontFamily: theme.font, fontSize: 20, fontWeight: 600, color: theme.textColor, fontStyle: 'italic' }}>
          {data.guest.name}
        </p>
        {rsvp && (
          <span style={{
            display: 'inline-block', marginTop: 10, padding: '4px 18px', borderRadius: 100,
            fontSize: 8, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const,
            color: rsvp.color, background: rsvp.bg, border: `1px solid ${rsvp.border}`,
          }}>{rsvp.label}</span>
        )}
      </div>
    );
  };

  const Footer = () => (
    <div style={{ textAlign: 'center', padding: '20px 36px 24px' }}>
      {data?.organizer?.name && (
        <p style={{ fontSize: 10, color: '#ABABAB', fontWeight: 300 }}>
          Hosted by <span style={{ fontWeight: 500, color: '#8A8A8A' }}>{data.organizer.name}</span>
        </p>
      )}
      {data?.invitation_code && (
        <p style={{ fontSize: 7, color: '#D4D0CA', marginTop: 8, letterSpacing: 4, fontFamily: "'Courier New', monospace" }}>
          {data.invitation_code}
        </p>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════
     WEDDING — Double-frame, L-shaped corners
     ═══════════════════════════════════════════ */
  const WeddingCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 16, overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ margin: 16, border: `1px solid ${theme.accent}30`, borderRadius: 8, position: 'relative', padding: '36px 32px 0' }}>
        <div style={{ position: 'absolute', top: -1, left: -1, width: 28, height: 28, borderTop: `2px solid ${theme.accent}`, borderLeft: `2px solid ${theme.accent}`, borderRadius: '4px 0 0 0' }} />
        <div style={{ position: 'absolute', top: -1, right: -1, width: 28, height: 28, borderTop: `2px solid ${theme.accent}`, borderRight: `2px solid ${theme.accent}`, borderRadius: '0 4px 0 0' }} />
        <div style={{ position: 'absolute', bottom: -1, left: -1, width: 28, height: 28, borderBottom: `2px solid ${theme.accent}`, borderLeft: `2px solid ${theme.accent}`, borderRadius: '0 0 0 4px' }} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 28, height: 28, borderBottom: `2px solid ${theme.accent}`, borderRight: `2px solid ${theme.accent}`, borderRadius: '0 0 4px 0' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, letterSpacing: 5, color: theme.accent, fontWeight: 500, textTransform: 'uppercase' as const, opacity: 0.7 }}>{theme.label}</p>
          <div style={{ position: 'relative', margin: '20px auto', width: 80, height: 1, background: `${theme.accent}40` }}>
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 10, color: theme.accent, background: theme.cardBg, padding: '0 10px' }}>❦</span>
          </div>
          <h2 style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 700, color: theme.textColor, lineHeight: 1.15, marginBottom: 8, letterSpacing: -0.5 }}>{data?.event?.title}</h2>
          {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 500, color: theme.accent, textTransform: 'uppercase' as const, marginBottom: 20 }}>{data.event.event_type}</p>}
        </div>
        <div style={{ margin: '0 auto 20px', width: 120 }}>
          <div style={{ height: 1, background: `${theme.accent}25` }} />
          <div style={{ height: 1, background: `${theme.accent}25`, marginTop: 3 }} />
        </div>
        <Details />
        <QrBlock />
        <GuestBlock borderColor={`${theme.accent}20`} />
        <Footer />
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════
     BIRTHDAY — Confetti dots, playful bold type
     ═══════════════════════════════════════════ */
  const BirthdayCard = () => {
    const dots = [
      { top: 12, left: 20, size: 6, color: '#E8446D' }, { top: 8, left: 60, size: 4, color: '#F59E0B' },
      { top: 20, left: 100, size: 5, color: '#3B82F6' }, { top: 6, left: 150, size: 7, color: '#10B981' },
      { top: 18, left: 200, size: 4, color: '#E8446D' }, { top: 10, left: 250, size: 6, color: '#8B5CF6' },
      { top: 22, left: 300, size: 5, color: '#F59E0B' }, { top: 14, left: 340, size: 4, color: '#3B82F6' },
      { top: 5, left: 370, size: 6, color: '#10B981' }, { top: 25, left: 390, size: 3, color: '#E8446D' },
    ];
    return (
      <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 20, overflow: 'hidden', fontFamily: theme.font }}>
        <div style={{ position: 'relative', height: 36, background: `${theme.accent}08`, overflow: 'hidden' }}>
          {dots.map((d, i) => <div key={i} style={{ position: 'absolute', top: d.top, left: d.left, width: d.size, height: d.size, borderRadius: '50%', background: d.color, opacity: 0.5 }} />)}
        </div>
        <div style={{ textAlign: 'center', padding: '28px 36px 0' }}>
          <span style={{ display: 'inline-block', padding: '6px 20px', borderRadius: 100, background: theme.accentLight, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: theme.accent }}>{theme.label}</span>
          <h2 style={{ fontFamily: theme.font, fontSize: 30, fontWeight: 800, color: theme.textColor, lineHeight: 1.2, marginTop: 20, marginBottom: 6 }}>{data?.event?.title}</h2>
          {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 600, color: theme.accent, textTransform: 'uppercase' as const, marginBottom: 20 }}>{data.event.event_type}</p>}
          <div style={{ margin: '0 auto 20px', width: 60, height: 3, borderRadius: 2, background: theme.accent, opacity: 0.25 }} />
        </div>
        <div style={{ padding: '0 36px' }}><Details /><QrBlock /><GuestBlock /></div>
        <Footer />
        <div style={{ position: 'relative', height: 24, background: `${theme.accent}08`, overflow: 'hidden' }}>
          {dots.slice(0, 6).reverse().map((d, i) => <div key={i} style={{ position: 'absolute', bottom: d.top - 4, left: d.left + 30, width: d.size, height: d.size, borderRadius: '50%', background: d.color, opacity: 0.4 }} />)}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════
     CORPORATE — Dark header band, geometric
     ═══════════════════════════════════════════ */
  const CorporateCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 12, overflow: 'hidden', fontFamily: theme.font, color: theme.textColor }}>
      <div style={{ background: '#1E293B', padding: '36px 36px 28px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: theme.accent }} />
        <div style={{ position: 'absolute', top: 16, right: 20, opacity: 0.08 }}>
          {[0, 1, 2].map(r => <div key={r} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{[0, 1, 2, 3].map(c => <div key={c} style={{ width: 3, height: 3, borderRadius: '50%', background: '#fff' }} />)}</div>)}
        </div>
        <p style={{ fontSize: 9, letterSpacing: 5, color: theme.accent, fontWeight: 500, textTransform: 'uppercase' as const, opacity: 0.9 }}>{theme.label}</p>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#F8FAFC', lineHeight: 1.2, marginTop: 16, letterSpacing: -0.3 }}>{data?.event?.title}</h2>
        {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 500, color: '#64748B', textTransform: 'uppercase' as const, marginTop: 8 }}>{data.event.event_type}</p>}
      </div>
      <div style={{ background: '#FFFFFF', padding: '28px 36px 0' }}>
        <div style={{ borderLeft: `3px solid ${theme.accent}`, paddingLeft: 16 }}>
          {data?.event?.start_date && <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>{formatDate(data.event.start_date)}</p>}
          {data?.event?.start_time && <p style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>{data.event.start_time}</p>}
          {(data?.event?.venue || data?.event?.location) && <p style={{ fontSize: 13, color: '#64748B' }}>{data.event.venue || data.event.location}</p>}
        </div>
        {data?.event?.dress_code && <div style={{ marginTop: 16 }}><span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: theme.accent, background: theme.accentLight, border: `1px solid ${theme.accent}20` }}>{data.event.dress_code}</span></div>}
        <div style={{ textAlign: 'center' }}><QrBlock /></div>
        <GuestBlock borderColor="#E2E8F0" />
      </div>
      <div style={{ background: '#FFFFFF' }}><Footer /></div>
    </div>
  );

  /* ═══════════════════════════════════════════
     MEMORIAL — Cross motif, muted, dignified
     ═══════════════════════════════════════════ */
  const MemorialCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 14, overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 1, background: '#D6D3D1', margin: '0 40px' }} />
      <div style={{ textAlign: 'center', padding: '40px 36px 0' }}>
        <div style={{ margin: '0 auto 24px', width: 24, height: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1.5, height: 32, background: theme.accent, opacity: 0.5 }} />
          <div style={{ position: 'absolute', top: 8, left: 0, width: 24, height: 1.5, background: theme.accent, opacity: 0.5 }} />
        </div>
        <p style={{ fontSize: 9, letterSpacing: 5, color: theme.accent, fontWeight: 500, textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 20 }}>{theme.label}</p>
        <h2 style={{ fontFamily: theme.font, fontSize: 30, fontWeight: 600, color: theme.textColor, lineHeight: 1.2, marginBottom: 8, fontStyle: 'italic' }}>{data?.event?.title}</h2>
        {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 500, color: theme.accent, textTransform: 'uppercase' as const, marginBottom: 24 }}>{data.event.event_type}</p>}
        <div style={{ margin: '0 auto 24px', width: 40, height: 1, background: '#D6D3D1' }} />
      </div>
      <div style={{ padding: '0 36px' }}><Details /><QrBlock /><GuestBlock borderColor="#E7E5E4" /></div>
      <Footer />
      <div style={{ height: 1, background: '#D6D3D1', margin: '0 40px 16px' }} />
    </div>
  );

  /* ═══════════════════════════════════════════
     ANNIVERSARY — Intertwined arcs, warm amber
     ═══════════════════════════════════════════ */
  const AnniversaryCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 16, overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '32px 36px 0' }}>
        <div style={{ margin: '0 auto 16px', position: 'relative', width: 48, height: 28 }}>
          <div style={{ position: 'absolute', left: 4, top: 4, width: 24, height: 24, border: `1.5px solid ${theme.accent}`, borderRadius: '50%', opacity: 0.4 }} />
          <div style={{ position: 'absolute', right: 4, top: 4, width: 24, height: 24, border: `1.5px solid ${theme.accent}`, borderRadius: '50%', opacity: 0.4 }} />
        </div>
        <p style={{ fontSize: 9, letterSpacing: 5, color: theme.accent, fontWeight: 500, textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 20 }}>{theme.label}</p>
        <h2 style={{ fontFamily: theme.font, fontSize: 32, fontWeight: 700, color: theme.textColor, lineHeight: 1.15, marginBottom: 8, letterSpacing: -0.3 }}>{data?.event?.title}</h2>
        {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 500, color: theme.accent, textTransform: 'uppercase' as const, marginBottom: 20 }}>{data.event.event_type}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          <div style={{ width: 40, height: 1, background: `${theme.accent}30` }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: theme.accent, opacity: 0.5 }} />
          <div style={{ width: 40, height: 1, background: `${theme.accent}30` }} />
        </div>
      </div>
      <div style={{ padding: '0 36px' }}><Details /><QrBlock /><GuestBlock borderColor={`${theme.accent}20`} /></div>
      <Footer />
    </div>
  );

  /* ═══════════════════════════════════════════
     CONFERENCE — Angled header slash
     ═══════════════════════════════════════════ */
  const ConferenceCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: '#FFFFFF', borderRadius: 12, overflow: 'hidden', fontFamily: theme.font }}>
      <div style={{ background: '#1E1B4B', padding: '32px 36px 40px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 3, background: theme.accent }} />
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 4, background: `${theme.accent}20`, fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' as const, color: theme.accent }}>{theme.label}</span>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#F5F3FF', lineHeight: 1.25, marginTop: 16, letterSpacing: -0.3 }}>{data?.event?.title}</h2>
        {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 500, color: '#A78BFA', textTransform: 'uppercase' as const, marginTop: 8 }}>{data.event.event_type}</p>}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 20, background: '#FFFFFF', clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
      </div>
      <div style={{ padding: '12px 36px 0' }}>
        <div style={{ borderLeft: `2px solid ${theme.accent}`, paddingLeft: 14, marginBottom: 20 }}>
          {data?.event?.start_date && <p style={{ fontSize: 14, fontWeight: 600, color: '#1E1B4B', marginBottom: 4 }}>{formatDate(data.event.start_date)}</p>}
          {data?.event?.start_time && <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{data.event.start_time}</p>}
          {(data?.event?.venue || data?.event?.location) && <p style={{ fontSize: 13, color: '#6B7280' }}>{data.event.venue || data.event.location}</p>}
        </div>
        {data?.event?.dress_code && <span style={{ display: 'inline-block', marginBottom: 16, padding: '5px 16px', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: theme.accent, background: theme.accentLight }}>{data.event.dress_code}</span>}
        <div style={{ textAlign: 'center' }}><QrBlock /></div>
        <GuestBlock borderColor="#E5E7EB" />
      </div>
      <Footer />
    </div>
  );

  /* ═══════════════════════════════════════════
     GRADUATION — Academic crest, laurel accents
     ═══════════════════════════════════════════ */
  const GraduationCard = () => (
    <div style={{ width: 420, margin: '0 auto', background: theme.cardBg, borderRadius: 16, overflow: 'hidden', fontFamily: theme.font }}>
      <div style={{ textAlign: 'center', padding: '32px 36px 0' }}>
        <div style={{ margin: '0 auto 16px', width: 44, height: 44, borderRadius: 8, background: `${theme.accent}12`, border: `1px solid ${theme.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎓</div>
        <p style={{ fontSize: 9, letterSpacing: 5, color: theme.accent, fontWeight: 600, textTransform: 'uppercase' as const, opacity: 0.8, marginBottom: 16 }}>{theme.label}</p>
        <h2 style={{ fontFamily: theme.font, fontSize: 28, fontWeight: 800, color: theme.textColor, lineHeight: 1.2, marginBottom: 8 }}>{data?.event?.title}</h2>
        {data?.event?.event_type && <p style={{ fontSize: 9, letterSpacing: 4, fontWeight: 600, color: theme.accent, textTransform: 'uppercase' as const, marginBottom: 20 }}>{data.event.event_type}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: theme.accent, opacity: 0.5, transform: 'scaleX(-1)', display: 'inline-block' }}>❧</span>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: theme.accent, opacity: 0.4 }} />
          <span style={{ fontSize: 12, color: theme.accent, opacity: 0.5 }}>❧</span>
        </div>
      </div>
      <div style={{ padding: '0 36px' }}><Details /><QrBlock /><GuestBlock borderColor={`${theme.accent}20`} /></div>
      <Footer />
    </div>
  );

  /* ── Card selector ── */
  const CardRenderer = () => {
    if (!data) return null;
    switch (typeKey) {
      case 'wedding': return <WeddingCard />;
      case 'birthday': return <BirthdayCard />;
      case 'corporate': return <CorporateCard />;
      case 'memorial': return <MemorialCard />;
      case 'anniversary': return <AnniversaryCard />;
      case 'conference': return <ConferenceCard />;
      case 'graduation': return <GraduationCard />;
      default: return <WeddingCard />;
    }
  };

  /* ═══════════════════════════════════════════════════════
     Print HTML — per-type unique designs matching preview
     ═══════════════════════════════════════════════════════ */
  const buildPrintHtml = useCallback(() => {
    const t = getTheme(data?.event?.event_type);
    const key = normalizeTypeKey(data?.event?.event_type);
    const qrImg = getQrDataUrl();
    const rsvp = data?.guest?.rsvp_status ? rsvpLabel(data.guest.rsvp_status) : null;
    

    const title = data?.event?.title || 'Event';
    const eventType = data?.event?.event_type || '';
    const date = data?.event?.start_date ? formatDate(data.event.start_date) : '';
    const time = data?.event?.start_time || '';
    const venue = data?.event?.venue || data?.event?.location || '';
    const dressCode = data?.event?.dress_code || '';
    const guestName = data?.guest?.name || '';
    const orgName = data?.organizer?.name || '';
    const invCode = data?.invitation_code || '';

    const fontsLink = `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">`;
    const baseStyle = `*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#F8F7F4;font-family:'Inter',system-ui,sans-serif}@media print{body{background:white}.card{box-shadow:none}}@page{size:auto;margin:10mm}`;

    const detailRowHtml = (text: string, primary?: boolean) =>
      `<div style="text-align:center;margin-bottom:8px"><span style="font-size:${primary ? 14 : 13}px;font-weight:${primary ? 500 : 400};color:${primary ? t.textColor : t.detailColor}">${text}</span></div>`;

    const detailsBlock = `<div style="text-align:center">${date ? detailRowHtml(date, true) : ''}${time ? detailRowHtml(time) : ''}${venue ? detailRowHtml(venue) : ''}${dressCode ? `<span style="display:inline-block;margin-top:8px;padding:5px 18px;border-radius:100px;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${t.accent};background:${t.accentLight};border:1px solid ${t.accent}22">${dressCode}</span>` : ''}</div>`;

    const qrBlock = (dark?: boolean) => qrImg ? `<div style="text-align:center;margin-top:24px"><div style="display:inline-block;padding:10px;border-radius:10px;background:${dark ? 'rgba(255,255,255,0.08)' : '#FAFAF8'};border:1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#F0EDE8'}"><img src="${qrImg}" style="width:72px;height:72px" /></div><p style="font-size:8px;color:${t.accent};margin-top:8px;letter-spacing:3px;text-transform:uppercase;font-weight:500;opacity:0.6">Scan to check in</p></div>` : '';

    const guestBlock = (borderColor: string) => guestName ? `<div style="text-align:center;margin:24px 36px 0;padding-top:20px;border-top:1px solid ${borderColor}"><p style="font-family:${t.font};font-size:20px;font-weight:600;color:${t.textColor};font-style:italic">${guestName}</p>${rsvp ? `<span style="display:inline-block;margin-top:10px;padding:4px 18px;border-radius:100px;font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${rsvp.color};background:${rsvp.bg};border:1px solid ${rsvp.border}">${rsvp.label}</span>` : ''}</div>` : '';

    const footerBlock = `<div style="text-align:center;padding:20px 36px 24px">${orgName ? `<p style="font-size:10px;color:#ABABAB;font-weight:300">Hosted by <span style="font-weight:500;color:#8A8A8A">${orgName}</span></p>` : ''}${invCode ? `<p style="font-size:7px;color:#D4D0CA;margin-top:8px;letter-spacing:4px;font-family:'Courier New',monospace">${invCode}</p>` : ''}</div>`;

    let cardBody = '';

    if (key === 'wedding') {
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:16px;overflow:hidden;font-family:'Inter',sans-serif"><div style="margin:16px;border:1px solid ${t.accent}30;border-radius:8px;position:relative;padding:36px 32px 0"><div style="position:absolute;top:-1px;left:-1px;width:28px;height:28px;border-top:2px solid ${t.accent};border-left:2px solid ${t.accent};border-radius:4px 0 0 0"></div><div style="position:absolute;top:-1px;right:-1px;width:28px;height:28px;border-top:2px solid ${t.accent};border-right:2px solid ${t.accent};border-radius:0 4px 0 0"></div><div style="position:absolute;bottom:-1px;left:-1px;width:28px;height:28px;border-bottom:2px solid ${t.accent};border-left:2px solid ${t.accent};border-radius:0 0 0 4px"></div><div style="position:absolute;bottom:-1px;right:-1px;width:28px;height:28px;border-bottom:2px solid ${t.accent};border-right:2px solid ${t.accent};border-radius:0 0 4px 0"></div><div style="text-align:center"><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:500;text-transform:uppercase;opacity:0.7">${t.label}</p><div style="position:relative;margin:20px auto;width:80px;height:1px;background:${t.accent}40"><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;color:${t.accent};background:${t.cardBg};padding:0 10px">❦</span></div><h2 style="font-family:${t.font};font-size:34px;font-weight:700;color:${t.textColor};line-height:1.15;margin-bottom:8px;letter-spacing:-0.5px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:500;color:${t.accent};text-transform:uppercase;margin-bottom:20px">${eventType}</p>` : ''}</div><div style="margin:0 auto 20px;width:120px"><div style="height:1px;background:${t.accent}25"></div><div style="height:1px;background:${t.accent}25;margin-top:3px"></div></div>${detailsBlock}${qrBlock()}${guestBlock(`${t.accent}20`)}${footerBlock}</div></div>`;
    } else if (key === 'birthday') {
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:20px;overflow:hidden;font-family:${t.font}"><div style="height:36px;background:${t.accent}08"></div><div style="text-align:center;padding:28px 36px 0"><span style="display:inline-block;padding:6px 20px;border-radius:100px;background:${t.accentLight};font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${t.accent}">${t.label}</span><h2 style="font-family:${t.font};font-size:30px;font-weight:800;color:${t.textColor};line-height:1.2;margin-top:20px;margin-bottom:6px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:600;color:${t.accent};text-transform:uppercase;margin-bottom:20px">${eventType}</p>` : ''}<div style="margin:0 auto 20px;width:60px;height:3px;border-radius:2px;background:${t.accent};opacity:0.25"></div></div><div style="padding:0 36px">${detailsBlock}${qrBlock()}${guestBlock(t.accentLight)}</div>${footerBlock}<div style="height:24px;background:${t.accent}08"></div></div>`;
    } else if (key === 'corporate') {
      const corpDetails = `<div style="border-left:3px solid ${t.accent};padding-left:16px">${date ? `<p style="font-size:14px;font-weight:600;color:#1E293B;margin-bottom:4px">${date}</p>` : ''}${time ? `<p style="font-size:13px;color:#64748B;margin-bottom:4px">${time}</p>` : ''}${venue ? `<p style="font-size:13px;color:#64748B">${venue}</p>` : ''}</div>${dressCode ? `<div style="margin-top:16px"><span style="display:inline-block;padding:5px 16px;border-radius:4px;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${t.accent};background:${t.accentLight}">${dressCode}</span></div>` : ''}`;
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:12px;overflow:hidden;font-family:${t.font}"><div style="background:#1E293B;padding:36px 36px 28px;position:relative"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:${t.accent}"></div><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:500;text-transform:uppercase;opacity:0.9">${t.label}</p><h2 style="font-size:28px;font-weight:700;color:#F8FAFC;line-height:1.2;margin-top:16px;letter-spacing:-0.3px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:500;color:#64748B;text-transform:uppercase;margin-top:8px">${eventType}</p>` : ''}</div><div style="background:#FFFFFF;padding:28px 36px 0">${corpDetails}<div style="text-align:center">${qrBlock()}</div>${guestBlock('#E2E8F0')}</div><div style="background:#FFFFFF">${footerBlock}</div></div>`;
    } else if (key === 'memorial') {
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:14px;overflow:hidden;font-family:'Inter',sans-serif"><div style="height:1px;background:#D6D3D1;margin:0 40px"></div><div style="text-align:center;padding:40px 36px 0"><div style="margin:0 auto 24px;width:24px;height:32px;position:relative"><div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:1.5px;height:32px;background:${t.accent};opacity:0.5"></div><div style="position:absolute;top:8px;left:0;width:24px;height:1.5px;background:${t.accent};opacity:0.5"></div></div><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:500;text-transform:uppercase;opacity:0.7;margin-bottom:20px">${t.label}</p><h2 style="font-family:${t.font};font-size:30px;font-weight:600;color:${t.textColor};line-height:1.2;margin-bottom:8px;font-style:italic">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:500;color:${t.accent};text-transform:uppercase;margin-bottom:24px">${eventType}</p>` : ''}<div style="margin:0 auto 24px;width:40px;height:1px;background:#D6D3D1"></div></div><div style="padding:0 36px">${detailsBlock}${qrBlock()}${guestBlock('#E7E5E4')}</div>${footerBlock}<div style="height:1px;background:#D6D3D1;margin:0 40px 16px"></div></div>`;
    } else if (key === 'anniversary') {
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:16px;overflow:hidden;font-family:'Inter',sans-serif"><div style="text-align:center;padding:32px 36px 0"><div style="margin:0 auto 16px;position:relative;width:48px;height:28px"><div style="position:absolute;left:4px;top:4px;width:24px;height:24px;border:1.5px solid ${t.accent};border-radius:50%;opacity:0.4"></div><div style="position:absolute;right:4px;top:4px;width:24px;height:24px;border:1.5px solid ${t.accent};border-radius:50%;opacity:0.4"></div></div><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:500;text-transform:uppercase;opacity:0.7;margin-bottom:20px">${t.label}</p><h2 style="font-family:${t.font};font-size:32px;font-weight:700;color:${t.textColor};line-height:1.15;margin-bottom:8px;letter-spacing:-0.3px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:500;color:${t.accent};text-transform:uppercase;margin-bottom:20px">${eventType}</p>` : ''}<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:20px"><div style="width:40px;height:1px;background:${t.accent}30"></div><div style="width:4px;height:4px;border-radius:50%;background:${t.accent};opacity:0.5"></div><div style="width:40px;height:1px;background:${t.accent}30"></div></div></div><div style="padding:0 36px">${detailsBlock}${qrBlock()}${guestBlock(`${t.accent}20`)}</div>${footerBlock}</div>`;
    } else if (key === 'conference') {
      const confDetails = `<div style="border-left:2px solid ${t.accent};padding-left:14px;margin-bottom:20px">${date ? `<p style="font-size:14px;font-weight:600;color:#1E1B4B;margin-bottom:4px">${date}</p>` : ''}${time ? `<p style="font-size:13px;color:#6B7280;margin-bottom:4px">${time}</p>` : ''}${venue ? `<p style="font-size:13px;color:#6B7280">${venue}</p>` : ''}</div>${dressCode ? `<span style="display:inline-block;margin-bottom:16px;padding:5px 16px;border-radius:4px;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${t.accent};background:${t.accentLight}">${dressCode}</span>` : ''}`;
      cardBody = `<div style="width:420px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:${t.font}"><div style="background:#1E1B4B;padding:32px 36px 40px;position:relative"><div style="position:absolute;top:0;left:0;width:80px;height:3px;background:${t.accent}"></div><span style="display:inline-block;padding:4px 12px;border-radius:4px;background:${t.accent}20;font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${t.accent}">${t.label}</span><h2 style="font-size:26px;font-weight:700;color:#F5F3FF;line-height:1.25;margin-top:16px;letter-spacing:-0.3px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:500;color:#A78BFA;text-transform:uppercase;margin-top:8px">${eventType}</p>` : ''}<div style="position:absolute;bottom:-1px;left:0;right:0;height:20px;background:#FFFFFF;clip-path:polygon(0 100%,100% 0,100% 100%)"></div></div><div style="padding:12px 36px 0">${confDetails}<div style="text-align:center">${qrBlock()}</div>${guestBlock('#E5E7EB')}</div>${footerBlock}</div>`;
    } else if (key === 'graduation') {
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:16px;overflow:hidden;font-family:${t.font}"><div style="text-align:center;padding:32px 36px 0"><div style="margin:0 auto 16px;width:44px;height:44px;border-radius:8px;background:${t.accent}12;border:1px solid ${t.accent}20;display:flex;align-items:center;justify-content:center;font-size:20px">🎓</div><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:600;text-transform:uppercase;opacity:0.8;margin-bottom:16px">${t.label}</p><h2 style="font-family:${t.font};font-size:28px;font-weight:800;color:${t.textColor};line-height:1.2;margin-bottom:8px">${title}</h2>${eventType ? `<p style="font-size:9px;letter-spacing:4px;font-weight:600;color:${t.accent};text-transform:uppercase;margin-bottom:20px">${eventType}</p>` : ''}<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px"><span style="font-size:12px;color:${t.accent};opacity:0.5;transform:scaleX(-1);display:inline-block">❧</span><div style="width:4px;height:4px;border-radius:50%;background:${t.accent};opacity:0.4"></div><span style="font-size:12px;color:${t.accent};opacity:0.5">❧</span></div></div><div style="padding:0 36px">${detailsBlock}${qrBlock()}${guestBlock(`${t.accent}20`)}</div>${footerBlock}</div>`;
    } else {
      // Fallback to wedding
      cardBody = `<div style="width:420px;margin:0 auto;background:${t.cardBg};border-radius:16px;overflow:hidden;text-align:center;padding:36px"><p style="font-size:9px;letter-spacing:5px;color:${t.accent};font-weight:500;text-transform:uppercase;opacity:0.7;margin-bottom:20px">${t.label}</p><h2 style="font-family:${t.font};font-size:30px;font-weight:700;color:${t.textColor};line-height:1.2;margin-bottom:12px">${title}</h2>${detailsBlock}${qrBlock()}${guestBlock(t.accentLight)}${footerBlock}</div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Event Invitation</title>${fontsLink}<style>${baseStyle}</style></head><body>${cardBody}</body></html>`;
  }, [data, getQrDataUrl]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildPrintHtml());
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none">
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-card rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-card rounded-2xl px-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : data ? (
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="max-h-[80vh] overflow-y-auto">
              <CardRenderer />
            </div>
            {/* Hidden QR for PDF */}
            <div ref={qrCanvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }}>
              <QRCodeCanvas value={buildQrValue()} size={240} level="H" includeMargin={false} fgColor="#1a1a2e" bgColor="#ffffff" />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <img src={PrintIcon} alt="Print" className="w-4 h-4 dark:invert" />
                Print
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationCard;

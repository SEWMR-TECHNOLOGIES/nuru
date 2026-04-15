import { QRCodeCanvas } from 'qrcode.react';

/* ═══════════════════════════════════════════════════════════
   NURU INVITATION CARD TEMPLATES — 10 Premium Designs
   Each template features ornamental SVG elements, rich
   gradients, layered frames, and elegant typography.
   ═══════════════════════════════════════════════════════════ */

export interface CardTemplateProps {
  title: string;
  eventType: string;
  date: string;
  time: string;
  venue: string;
  dressCode: string;
  guestName: string;
  rsvpStatus: { label: string; bg: string; color: string; border: string } | null;
  organizerName: string;
  invitationCode: string;
  qrValue: string;
}

/* ──────────────────────────────────────
   SHARED DECORATIVE SVG COMPONENTS
   ────────────────────────────────────── */

/** Ornate floral corner — dahlia/chrysanthemum with leaves */
const FloralCorner = ({ color, leafColor, size = 70, style }: { color: string; leafColor: string; size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" style={style}>
    {/* Main flower */}
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
      <ellipse key={angle} cx="16" cy="16" rx="5" ry="12" fill={color} opacity={0.85}
        transform={`rotate(${angle} 16 16)`} />
    ))}
    <circle cx="16" cy="16" r="5" fill={leafColor} />
    <circle cx="16" cy="16" r="3" fill={color} opacity={0.6} />
    {/* Small buds */}
    {[0, 25, 50, 75, 100, 125, 150].map((angle, i) => (
      <circle key={`bud-${i}`} cx={30 + Math.cos(angle * Math.PI / 180) * 15} cy={30 + Math.sin(angle * Math.PI / 180) * 15}
        r={1.5 + (i % 3)} fill={leafColor} opacity={0.4 + (i % 3) * 0.15} />
    ))}
    {/* Leaves */}
    <ellipse cx="40" cy="12" rx="14" ry="5" fill={leafColor} opacity={0.35} transform="rotate(-25 40 12)" />
    <ellipse cx="12" cy="40" rx="14" ry="5" fill={leafColor} opacity={0.35} transform="rotate(-65 12 40)" />
    <ellipse cx="50" cy="25" rx="10" ry="3.5" fill={leafColor} opacity={0.25} transform="rotate(-15 50 25)" />
    <ellipse cx="25" cy="50" rx="10" ry="3.5" fill={leafColor} opacity={0.25} transform="rotate(-75 25 50)" />
    {/* Vine stems */}
    <path d="M20,20 C28,35 42,50 65,58" stroke={leafColor} fill="none" strokeWidth="0.6" opacity={0.35} />
    <path d="M20,20 C35,28 50,42 58,65" stroke={leafColor} fill="none" strokeWidth="0.6" opacity={0.35} />
    {/* Gold dots/berries */}
    <circle cx="35" cy="8" r="2" fill={leafColor} opacity={0.5} />
    <circle cx="8" cy="35" r="2" fill={leafColor} opacity={0.5} />
    <circle cx="55" cy="20" r="1.5" fill={leafColor} opacity={0.4} />
    <circle cx="20" cy="55" r="1.5" fill={leafColor} opacity={0.4} />
    <circle cx="48" cy="38" r="1" fill={leafColor} opacity={0.35} />
    <circle cx="38" cy="48" r="1" fill={leafColor} opacity={0.35} />
  </svg>
);

/** Art deco geometric corner */
const DecoCorner = ({ color, size = 50, style }: { color: string; size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" style={style}>
    <path d="M0,0 L0,40 L3,40 L3,3 L40,3 L40,0 Z" fill={color} opacity={0.15} />
    <path d="M0,0 L0,30 L1.5,30 L1.5,1.5 L30,1.5 L30,0 Z" fill={color} opacity={0.3} />
    <rect x="0" y="0" width="8" height="8" fill={color} opacity={0.2} />
    <circle cx="4" cy="4" r="2" fill={color} opacity={0.6} />
    <line x1="8" y1="0" x2="8" y2="20" stroke={color} strokeWidth="0.5" opacity={0.3} />
    <line x1="0" y1="8" x2="20" y2="8" stroke={color} strokeWidth="0.5" opacity={0.3} />
    {[12, 16, 20, 24].map(p => (
      <circle key={p} cx={p} cy="1" r="0.8" fill={color} opacity={0.25} />
    ))}
    {[12, 16, 20, 24].map(p => (
      <circle key={`v-${p}`} cx="1" cy={p} r="0.8" fill={color} opacity={0.25} />
    ))}
  </svg>
);

/** Scroll/vine corner ornament */
const ScrollCorner = ({ color, size = 55, style }: { color: string; size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 55 55" style={style}>
    <path d="M2,2 C2,22 6,32 18,38 C10,32 6,20 4,2" stroke={color} fill={`${color}18`} strokeWidth="0.8" />
    <path d="M2,2 C22,2 32,6 38,18 C32,10 20,6 2,4" stroke={color} fill={`${color}18`} strokeWidth="0.8" />
    <path d="M6,6 C6,16 10,22 18,26" stroke={color} fill="none" strokeWidth="0.5" opacity={0.5} />
    <path d="M6,6 C16,6 22,10 26,18" stroke={color} fill="none" strokeWidth="0.5" opacity={0.5} />
    <circle cx="4" cy="4" r="2.5" fill={color} opacity={0.7} />
    <circle cx="2" cy="10" r="1.2" fill={color} opacity={0.4} />
    <circle cx="10" cy="2" r="1.2" fill={color} opacity={0.4} />
    <path d="M18,38 C22,42 28,44 38,44" stroke={color} fill="none" strokeWidth="0.6" opacity={0.3} />
    <path d="M38,18 C42,22 44,28 44,38" stroke={color} fill="none" strokeWidth="0.6" opacity={0.3} />
    <circle cx="40" cy="44" r="1.5" fill={color} opacity={0.3} />
    <circle cx="44" cy="40" r="1.5" fill={color} opacity={0.3} />
  </svg>
);

/** Laurel leaf pair */
const LaurelCorner = ({ color, size = 50, style }: { color: string; size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" style={style}>
    {[0, 8, 16, 24].map(offset => (
      <g key={offset}>
        <ellipse cx={6 + offset * 0.5} cy={6 + offset} rx="3" ry="6" fill={color} opacity={0.3 - offset * 0.03}
          transform={`rotate(-30 ${6 + offset * 0.5} ${6 + offset})`} />
        <ellipse cx={6 + offset} cy={6 + offset * 0.5} rx="6" ry="3" fill={color} opacity={0.3 - offset * 0.03}
          transform={`rotate(-30 ${6 + offset} ${6 + offset * 0.5})`} />
      </g>
    ))}
    <path d="M3,3 C10,20 20,35 42,42" stroke={color} fill="none" strokeWidth="0.5" opacity={0.4} />
    <circle cx="3" cy="3" r="2" fill={color} opacity={0.5} />
  </svg>
);

/** Four corners of a given ornament type */
const FourCorners = ({ children, offset = 8 }: { children: (pos: 'tl' | 'tr' | 'bl' | 'br') => React.ReactNode; offset?: number }) => (
  <>
    <div style={{ position: 'absolute', top: offset, left: offset }}>{children('tl')}</div>
    <div style={{ position: 'absolute', top: offset, right: offset, transform: 'scaleX(-1)' }}>{children('tr')}</div>
    <div style={{ position: 'absolute', bottom: offset, left: offset, transform: 'scaleY(-1)' }}>{children('bl')}</div>
    <div style={{ position: 'absolute', bottom: offset, right: offset, transform: 'scale(-1,-1)' }}>{children('br')}</div>
  </>
);

/** Ornamental divider line with center motif */
const OrnamentDivider = ({ color, width = 140, variant = 'diamond' }: { color: string; width?: number; variant?: 'diamond' | 'dots' | 'scroll' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px auto', width }}>
    <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${color})` }} />
    {variant === 'diamond' && (
      <div style={{ margin: '0 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 3, height: 3, transform: 'rotate(45deg)', background: color, opacity: 0.5 }} />
        <div style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: color }} />
        <div style={{ width: 3, height: 3, transform: 'rotate(45deg)', background: color, opacity: 0.5 }} />
      </div>
    )}
    {variant === 'dots' && (
      <div style={{ margin: '0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, opacity: 0.4 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, opacity: 0.4 }} />
      </div>
    )}
    {variant === 'scroll' && (
      <svg width="30" height="12" viewBox="0 0 30 12" style={{ margin: '0 6px' }}>
        <path d="M0,6 C5,0 10,0 15,6 C20,12 25,12 30,6" stroke={color} fill="none" strokeWidth="1" />
      </svg>
    )}
    <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${color})` }} />
  </div>
);

/** Decorative border frame pattern (repeating dots along edges) */
const DotBorderPattern = ({ color, opacity = 0.15 }: { color: string; opacity?: number }) => (
  <div style={{ position: 'absolute', inset: 12, pointerEvents: 'none' }}>
    {/* Top edge dots */}
    <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, display: 'flex', justifyContent: 'space-between' }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={`t${i}`} style={{ width: 2, height: 2, borderRadius: '50%', background: color, opacity }} />
      ))}
    </div>
    {/* Bottom edge dots */}
    <div style={{ position: 'absolute', bottom: 0, left: 20, right: 20, height: 1, display: 'flex', justifyContent: 'space-between' }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={`b${i}`} style={{ width: 2, height: 2, borderRadius: '50%', background: color, opacity }} />
      ))}
    </div>
  </div>
);

/* ──────────────────────────────────────
   SHARED DATA DISPLAY COMPONENTS
   ────────────────────────────────────── */

const QrBlock = ({ qrValue, fgColor = '#1a1a2e', bgColor = 'transparent', containerBg, containerBorder, accentColor, size = 72 }: {
  qrValue: string; fgColor?: string; bgColor?: string; containerBg?: string; containerBorder?: string; accentColor: string; size?: number;
}) => (
  <div style={{ textAlign: 'center', marginTop: 20 }}>
    <div style={{
      display: 'inline-block', padding: 10, borderRadius: 10,
      background: containerBg || 'rgba(255,255,255,0.5)', border: `1px solid ${containerBorder || accentColor + '30'}`,
      boxShadow: `0 2px 12px ${accentColor}15`,
    }}>
      <QRCodeCanvas value={qrValue} size={size} level="H" includeMargin={false} fgColor={fgColor} bgColor={bgColor} />
    </div>
    <p style={{ fontSize: 7, color: accentColor, marginTop: 8, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600, opacity: 0.6 }}>
      Scan to check in
    </p>
  </div>
);

const RsvpBadge = ({ rsvp }: { rsvp: CardTemplateProps['rsvpStatus'] }) => {
  if (!rsvp) return null;
  return (
    <span style={{
      display: 'inline-block', marginTop: 10, padding: '4px 18px', borderRadius: 100,
      fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
      color: rsvp.color, background: rsvp.bg, border: `1px solid ${rsvp.border}`,
    }}>{rsvp.label}</span>
  );
};

const FooterBlock = ({ organizerName, invitationCode, color = '#ABABAB' }: { organizerName: string; invitationCode: string; color?: string }) => (
  <div style={{ textAlign: 'center', padding: '16px 30px 20px' }}>
    {organizerName && (
      <p style={{ fontSize: 10, color, fontWeight: 300 }}>
        Hosted by <span style={{ fontWeight: 600, color: color }}>{organizerName}</span>
      </p>
    )}
    {invitationCode && (
      <p style={{ fontSize: 7, color, marginTop: 6, letterSpacing: 4, fontFamily: "'Courier New', monospace", opacity: 0.5 }}>
        {invitationCode}
      </p>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   TEMPLATE 1: ROYAL GOLD — Ornate gold frame, floral corners
   ══════════════════════════════════════════════════════════════ */
const RoyalGoldCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
    background: 'linear-gradient(160deg, #FBF7F0 0%, #F5EDE0 40%, #FBF7F0 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(184,150,106,0.15)',
  }}>
    {/* Subtle pattern overlay */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.04,
      backgroundImage: 'radial-gradient(circle, #B8956A 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }} />
    {/* Outer gold border */}
    <div style={{ position: 'absolute', inset: 6, border: '1.5px solid #C5A55A', borderRadius: 2 }} />
    {/* Inner gold border */}
    <div style={{ position: 'absolute', inset: 12, border: '0.5px solid #C5A55A50' }} />
    {/* Gold gradient edge strip */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37, #B8956A, #D4AF37, transparent)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37, #B8956A, #D4AF37, transparent)' }} />
    {/* Floral corners */}
    <FourCorners offset={2}>
      {() => <FloralCorner color="#8B2020" leafColor="#C5A55A" size={75} />}
    </FourCorners>
    <DotBorderPattern color="#C5A55A" opacity={0.2} />
    {/* Content */}
    <div style={{ position: 'relative', padding: '60px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#B8956A', fontWeight: 500, textTransform: 'uppercase', opacity: 0.8 }}>
        You are cordially invited
      </p>
      <OrnamentDivider color="#C5A55A" width={120} variant="diamond" />
      <h2 style={{ fontSize: 36, fontWeight: 700, color: '#2C1810', lineHeight: 1.15, margin: '8px 0', letterSpacing: -0.5 }}>
        {title}
      </h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#B8956A', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#C5A55A80" width={100} variant="scroll" />
      {/* Event details */}
      <div style={{ margin: '12px 0' }}>
        {date && <p style={{ fontSize: 15, fontWeight: 600, color: '#2C1810', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#5C4F3D', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#5C4F3D' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#B8956A', background: '#F0E6D320', border: '1px solid #C5A55A40' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#B8956A" containerBg="#FFFDF820" containerBorder="#C5A55A30" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #C5A55A30' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#2C1810', fontStyle: 'italic' }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#A09080" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 2: CRIMSON ROSE — Deep red florals, gold accents
   ══════════════════════════════════════════════════════════════ */
const CrimsonRoseCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
    background: 'linear-gradient(170deg, #FFF8F0 0%, #FAF0E6 50%, #FFF5EB 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(139,26,26,0.1)',
  }}>
    {/* Warm glow at top */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, #D4AF3710, transparent)' }} />
    {/* Gold frame */}
    <div style={{ position: 'absolute', inset: 10, border: '2px solid #C5943A', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 14, border: '0.5px solid #C5943A40' }} />
    {/* Crimson gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #8B1A1A, #C5943A, #8B1A1A)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #8B1A1A, #C5943A, #8B1A1A)' }} />
    {/* Large floral corners */}
    <FourCorners offset={-2}>
      {() => <FloralCorner color="#8B1A1A" leafColor="#C5943A" size={85} />}
    </FourCorners>
    {/* Additional small flowers mid-sides */}
    <div style={{ position: 'absolute', top: '50%', left: 4, transform: 'translateY(-50%)' }}>
      <FloralCorner color="#8B1A1A" leafColor="#C5943A" size={30} />
    </div>
    <div style={{ position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%) scaleX(-1)' }}>
      <FloralCorner color="#8B1A1A" leafColor="#C5943A" size={30} />
    </div>
    {/* Content */}
    <div style={{ position: 'relative', padding: '65px 44px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#8B1A1A', fontWeight: 500, textTransform: 'uppercase' }}>
        Save the Date
      </p>
      <OrnamentDivider color="#C5943A" width={130} variant="dots" />
      <h2 style={{ fontSize: 34, fontWeight: 700, color: '#2C1810', lineHeight: 1.15, marginBottom: 8 }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#C5943A', textTransform: 'uppercase', marginBottom: 12 }}>{eventType}</p>}
      <OrnamentDivider color="#8B1A1A50" width={80} variant="diamond" />
      <div style={{ margin: '8px 0' }}>
        {date && <p style={{ fontSize: 15, fontWeight: 600, color: '#2C1810', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#5C4030', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#5C4030' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#8B1A1A', background: '#8B1A1A10', border: '1px solid #8B1A1A25' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#8B1A1A" containerBg="#FFF8F5" containerBorder="#C5943A30" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #C5943A30' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#2C1810', fontStyle: 'italic' }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#9A8070" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 3: SAPPHIRE NIGHT — Deep navy, gold embroidery
   ══════════════════════════════════════════════════════════════ */
const SapphireNightCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif",
    background: 'linear-gradient(160deg, #0C1B33 0%, #152238 30%, #0F1D30 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
  }}>
    {/* Subtle textile pattern */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.06,
      backgroundImage: 'repeating-linear-gradient(45deg, #D4AF37 0, #D4AF37 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, #D4AF37 0, #D4AF37 1px, transparent 1px, transparent 8px)',
    }} />
    {/* Gold borders */}
    <div style={{ position: 'absolute', inset: 8, border: '1.5px solid #D4AF37', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 14, border: '0.5px solid #D4AF3740' }} />
    {/* Decorative corners */}
    <FourCorners offset={4}>
      {() => <DecoCorner color="#D4AF37" size={45} />}
    </FourCorners>
    <DotBorderPattern color="#D4AF37" opacity={0.2} />
    {/* Gold top/bottom strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37, #B8860B, #D4AF37, transparent)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37, #B8860B, #D4AF37, transparent)' }} />
    {/* Content */}
    <div style={{ position: 'relative', padding: '50px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#D4AF37', fontWeight: 500, textTransform: 'uppercase' }}>
        You are invited
      </p>
      <OrnamentDivider color="#D4AF37" width={120} variant="diamond" />
      <h2 style={{ fontSize: 30, fontWeight: 700, color: '#F0E6D3', lineHeight: 1.2, marginBottom: 8, letterSpacing: -0.3 }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#D4AF37', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#D4AF3760" width={100} variant="scroll" />
      <div style={{ margin: '10px 0' }}>
        {date && <p style={{ fontSize: 14, fontWeight: 600, color: '#E8DCC8', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#94A3B8' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#D4AF37', background: '#D4AF3712', border: '1px solid #D4AF3730' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#D4AF37" fgColor="#E8DCC8" containerBg="rgba(212,175,55,0.06)" containerBorder="#D4AF3725" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #D4AF3725' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#F0E6D3', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#7A8A9A" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 4: BLUSH GARDEN — Soft pink, rose gold elegance
   ══════════════════════════════════════════════════════════════ */
const BlushGardenCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
    background: 'linear-gradient(160deg, #FFF5F5 0%, #FFE8E8 40%, #FFF0F0 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(183,110,121,0.12)',
  }}>
    {/* Rose gold borders */}
    <div style={{ position: 'absolute', inset: 8, border: '1.5px solid #B76E79', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 13, border: '0.5px solid #B76E7940' }} />
    {/* Rose gold gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #B76E79, #D4A0A8, #B76E79, transparent)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #B76E79, #D4A0A8, #B76E79, transparent)' }} />
    {/* Scroll corners */}
    <FourCorners offset={4}>
      {() => <ScrollCorner color="#B76E79" size={50} />}
    </FourCorners>
    <DotBorderPattern color="#B76E79" opacity={0.15} />
    {/* Content */}
    <div style={{ position: 'relative', padding: '55px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#B76E79', fontWeight: 500, textTransform: 'uppercase', opacity: 0.8 }}>
        Join us in celebrating
      </p>
      <OrnamentDivider color="#B76E79" width={120} variant="scroll" />
      <h2 style={{ fontSize: 34, fontWeight: 700, color: '#3D1F25', lineHeight: 1.15, marginBottom: 8, fontStyle: 'italic' }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#B76E79', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#B76E7950" width={80} variant="dots" />
      <div style={{ margin: '8px 0' }}>
        {date && <p style={{ fontSize: 15, fontWeight: 600, color: '#3D1F25', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#6D4A52', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#6D4A52' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#B76E79', background: '#B76E7910', border: '1px solid #B76E7925' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#B76E79" containerBg="#FFF8F8" containerBorder="#B76E7920" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #B76E7925' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#3D1F25', fontStyle: 'italic' }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#A08088" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 5: EMERALD CROWN — Rich green, gold laurels
   ══════════════════════════════════════════════════════════════ */
const EmeraldCrownCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif",
    background: 'linear-gradient(160deg, #F0F7F2 0%, #E8F0EA 40%, #F0F7F2 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(27,107,77,0.1)',
  }}>
    {/* Emerald + gold borders */}
    <div style={{ position: 'absolute', inset: 8, border: '2px solid #1B6B4D', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 13, border: '0.5px solid #C5A55A50' }} />
    {/* Green/gold gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #1B6B4D, #C5A55A, #1B6B4D)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #1B6B4D, #C5A55A, #1B6B4D)' }} />
    {/* Laurel corners */}
    <FourCorners offset={4}>
      {() => <LaurelCorner color="#1B6B4D" size={55} />}
    </FourCorners>
    {/* Crest/shield motif at top center */}
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)' }}>
      <svg width="40" height="36" viewBox="0 0 40 36">
        <path d="M20,2 L36,10 L36,22 C36,28 28,34 20,36 C12,34 4,28 4,22 L4,10 Z" fill="none" stroke="#C5A55A" strokeWidth="1" opacity={0.4} />
        <path d="M20,6 L32,12 L32,22 C32,26 26,30 20,32 C14,30 8,26 8,22 L8,12 Z" fill="#1B6B4D10" stroke="#1B6B4D" strokeWidth="0.5" opacity={0.3} />
        <circle cx="20" cy="18" r="4" fill="#C5A55A" opacity={0.3} />
      </svg>
    </div>
    {/* Content */}
    <div style={{ position: 'relative', padding: '58px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#1B6B4D', fontWeight: 600, textTransform: 'uppercase' }}>
        You are invited to celebrate
      </p>
      <OrnamentDivider color="#1B6B4D" width={120} variant="diamond" />
      <h2 style={{ fontSize: 30, fontWeight: 800, color: '#0A2E1D', lineHeight: 1.2, marginBottom: 8 }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 600, color: '#C5A55A', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#1B6B4D50" width={100} variant="dots" />
      <div style={{ margin: '10px 0' }}>
        {date && <p style={{ fontSize: 14, fontWeight: 600, color: '#0A2E1D', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#3D6B52', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#3D6B52' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#1B6B4D', background: '#1B6B4D10', border: '1px solid #1B6B4D20' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#1B6B4D" containerBg="#F8FBF9" containerBorder="#1B6B4D20" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #1B6B4D20' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#0A2E1D', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#6B8A78" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 6: AMBER HERITAGE — Warm Swahili-inspired geometric
   ══════════════════════════════════════════════════════════════ */
const AmberHeritageCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif",
    background: 'linear-gradient(160deg, #FFF5E6 0%, #FAEBD7 40%, #FFF0D5 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(198,123,48,0.15)',
  }}>
    {/* African geometric pattern border */}
    <div style={{
      position: 'absolute', inset: 0,
      borderImage: 'repeating-linear-gradient(90deg, #C67B30 0px, #C67B30 8px, #8B4513 8px, #8B4513 12px, #C67B30 12px, #C67B30 20px) 6',
      borderWidth: 6, borderStyle: 'solid',
    }} />
    {/* Inner borders */}
    <div style={{ position: 'absolute', inset: 10, border: '1.5px solid #C67B30' }} />
    <div style={{ position: 'absolute', inset: 14, border: '0.5px solid #C67B3040' }} />
    {/* Geometric corner triangles */}
    <FourCorners offset={11}>
      {() => (
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="0,0 35,0 0,35" fill="#C67B30" opacity={0.1} />
          <polygon points="0,0 25,0 0,25" fill="#8B4513" opacity={0.08} />
          <polygon points="0,0 15,0 0,15" fill="#C67B30" opacity={0.15} />
          <circle cx="5" cy="5" r="2" fill="#C67B30" opacity={0.4} />
          {[10, 15, 20, 25, 30].map(p => (
            <circle key={p} cx={p} cy="2" r="1" fill="#C67B30" opacity={0.2} />
          ))}
          {[10, 15, 20, 25, 30].map(p => (
            <circle key={`v-${p}`} cx="2" cy={p} r="1" fill="#C67B30" opacity={0.2} />
          ))}
        </svg>
      )}
    </FourCorners>
    {/* Zigzag divider at top */}
    <div style={{ position: 'absolute', top: 6, left: 40, right: 40, height: 4 }}>
      <svg width="100%" height="4" viewBox="0 0 340 4" preserveAspectRatio="none">
        <path d="M0,2 L5,0 L10,2 L15,0 L20,2 L25,0 L30,2 L35,0 L40,2 L45,0 L50,2 L55,0 L60,2 L65,0 L70,2 L75,0 L80,2 L85,0 L90,2 L95,0 L100,2" stroke="#C67B30" strokeWidth="0.5" fill="none" opacity={0.4} />
      </svg>
    </div>
    {/* Content */}
    <div style={{ position: 'relative', padding: '50px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#8B4513', fontWeight: 600, textTransform: 'uppercase' }}>
        Karibu — You are invited
      </p>
      <OrnamentDivider color="#C67B30" width={130} variant="diamond" />
      <h2 style={{ fontSize: 32, fontWeight: 800, color: '#3D1C00', lineHeight: 1.15, marginBottom: 8 }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 600, color: '#C67B30', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      {/* Geometric kente-style divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, margin: '12px auto', width: 120 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} style={{ width: i % 2 === 0 ? 10 : 6, height: 3, background: i % 2 === 0 ? '#C67B30' : '#8B4513', borderRadius: 1, opacity: 0.5 + (i % 3) * 0.15 }} />
        ))}
      </div>
      <div style={{ margin: '10px 0' }}>
        {date && <p style={{ fontSize: 14, fontWeight: 600, color: '#3D1C00', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#6B4A30', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#6B4A30' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#8B4513', background: '#C67B3010', border: '1px solid #C67B3025' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#C67B30" containerBg="#FFF8F0" containerBorder="#C67B3025" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #C67B3025' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#3D1C00', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#8A7060" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 7: VIOLET DYNASTY — Royal purple, silver elegance
   ══════════════════════════════════════════════════════════════ */
const VioletDynastyCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
    background: 'linear-gradient(160deg, #F8F4FF 0%, #EDE5F5 40%, #F5F0FA 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(91,33,182,0.1)',
  }}>
    {/* Purple frame */}
    <div style={{ position: 'absolute', inset: 8, border: '1.5px solid #7C3AED', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 13, border: '0.5px solid #7C3AED35' }} />
    {/* Silver/purple gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #7C3AED, #A78BFA, #7C3AED, transparent)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #7C3AED, #A78BFA, #7C3AED, transparent)' }} />
    {/* Floral corners in purple/silver */}
    <FourCorners offset={0}>
      {() => <FloralCorner color="#7C3AED" leafColor="#A78BFA" size={65} />}
    </FourCorners>
    <DotBorderPattern color="#7C3AED" opacity={0.12} />
    {/* Content */}
    <div style={{ position: 'relative', padding: '55px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#7C3AED', fontWeight: 500, textTransform: 'uppercase', opacity: 0.8 }}>
        You are honoured with this invitation
      </p>
      <OrnamentDivider color="#7C3AED" width={120} variant="scroll" />
      <h2 style={{ fontSize: 34, fontWeight: 700, color: '#1E1B4B', lineHeight: 1.15, marginBottom: 8, fontStyle: 'italic' }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#A78BFA', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#7C3AED40" width={100} variant="dots" />
      <div style={{ margin: '8px 0' }}>
        {date && <p style={{ fontSize: 15, fontWeight: 600, color: '#1E1B4B', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#5B4A8A', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#5B4A8A' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#7C3AED', background: '#7C3AED10', border: '1px solid #7C3AED20' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#7C3AED" containerBg="#FAF8FF" containerBorder="#7C3AED20" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #7C3AED20' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#1E1B4B', fontStyle: 'italic' }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#8878A8" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 8: NOIR & GOLD — Dramatic black, gold luxury
   ══════════════════════════════════════════════════════════════ */
const NoirGoldCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif",
    background: 'linear-gradient(160deg, #0A0A0A 0%, #151515 30%, #0D0D0D 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
  }}>
    {/* Subtle diamond pattern */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.04,
      backgroundImage: 'repeating-linear-gradient(45deg, #D4AF37 0, #D4AF37 1px, transparent 1px, transparent 12px)',
    }} />
    {/* Gold borders — triple frame */}
    <div style={{ position: 'absolute', inset: 6, border: '2px solid #D4AF37' }} />
    <div style={{ position: 'absolute', inset: 12, border: '0.5px solid #D4AF3740' }} />
    <div style={{ position: 'absolute', inset: 16, border: '0.5px solid #D4AF3720' }} />
    {/* Gold gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #0A0A0A, #D4AF37, #FFD700, #D4AF37, #0A0A0A)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #0A0A0A, #D4AF37, #FFD700, #D4AF37, #0A0A0A)' }} />
    {/* Deco corners */}
    <FourCorners offset={3}>
      {() => <DecoCorner color="#D4AF37" size={50} />}
    </FourCorners>
    <DotBorderPattern color="#D4AF37" opacity={0.25} />
    {/* Content */}
    <div style={{ position: 'relative', padding: '55px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 7, color: '#D4AF37', fontWeight: 600, textTransform: 'uppercase' }}>
        You are invited
      </p>
      <OrnamentDivider color="#D4AF37" width={130} variant="diamond" />
      <h2 style={{ fontSize: 30, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 8, letterSpacing: 0.5 }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 600, color: '#D4AF37', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <OrnamentDivider color="#D4AF3760" width={100} variant="scroll" />
      <div style={{ margin: '10px 0' }}>
        {date && <p style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E0', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#A0A0A0' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#D4AF37', background: '#D4AF3710', border: '1px solid #D4AF3730' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#D4AF37" fgColor="#F0E6D3" containerBg="rgba(212,175,55,0.05)" containerBorder="#D4AF3720" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #D4AF3720' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#6A6A6A" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 9: TROPICAL CELEBRATION — Vibrant birthday/party
   ══════════════════════════════════════════════════════════════ */
const TropicalCelebrationCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => {
  const confettiColors = ['#E8446D', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
  return (
    <div style={{
      width: 420, margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif",
      background: 'linear-gradient(160deg, #FFFAF5 0%, #FFF5EB 30%, #FFF0F3 100%)',
      borderRadius: 4, overflow: 'hidden', position: 'relative',
      boxShadow: '0 4px 30px rgba(232,68,109,0.12)',
    }}>
      {/* Colorful top bar */}
      <div style={{ height: 6, background: 'linear-gradient(90deg, #E8446D, #F59E0B, #3B82F6, #10B981, #8B5CF6, #EC4899)' }} />
      {/* Confetti dots */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const color = confettiColors[i % confettiColors.length];
          const size = 3 + (i % 5) * 1.5;
          const top = 10 + (i * 37) % 90;
          const left = 2 + (i * 23) % 96;
          const isEdge = left < 12 || left > 88 || top < 15 || top > 85;
          if (!isEdge) return null;
          return (
            <div key={i} style={{
              position: 'absolute', top: `${top}%`, left: `${left}%`,
              width: size, height: size, borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
              background: color, opacity: 0.2 + (i % 4) * 0.08,
              transform: i % 2 === 0 ? `rotate(${i * 30}deg)` : 'none',
            }} />
          );
        })}
      </div>
      {/* Frame with colorful border */}
      <div style={{ position: 'absolute', inset: 10, border: '2px solid #E8446D30', borderRadius: 12 }} />
      <div style={{ position: 'absolute', inset: 14, border: '0.5px solid #F59E0B25', borderRadius: 10 }} />
      {/* Content */}
      <div style={{ position: 'relative', padding: '45px 40px 0', textAlign: 'center' }}>
        <span style={{
          display: 'inline-block', padding: '6px 22px', borderRadius: 100,
          background: 'linear-gradient(135deg, #E8446D15, #F59E0B15)',
          fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: '#E8446D',
          border: '1px solid #E8446D20',
        }}>
          {"You're invited to celebrate"}
        </span>
        <OrnamentDivider color="#F59E0B" width={100} variant="dots" />
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1A1A2E', lineHeight: 1.2, marginBottom: 6 }}>{title}</h2>
        {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 700, color: '#E8446D', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
        {/* Colorful bar divider */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 16 }}>
          {confettiColors.slice(0, 5).map((c, i) => (
            <div key={i} style={{ width: 16, height: 3, borderRadius: 2, background: c, opacity: 0.4 }} />
          ))}
        </div>
        <div style={{ margin: '8px 0' }}>
          {date && <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>{date}</p>}
          {time && <p style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{time}</p>}
          {venue && <p style={{ fontSize: 13, color: '#555' }}>{venue}</p>}
          {dressCode && (
            <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#8B5CF6', background: '#8B5CF610', border: '1px solid #8B5CF620' }}>
              {dressCode}
            </span>
          )}
        </div>
        <QrBlock qrValue={qrValue} accentColor="#E8446D" containerBg="#FFFBF8" containerBorder="#E8446D15" />
        {guestName && (
          <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #E8446D18' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>{guestName}</p>
            <RsvpBadge rsvp={rsvpStatus} />
          </div>
        )}
        <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#999" />
      </div>
      {/* Colorful bottom bar */}
      <div style={{ height: 6, background: 'linear-gradient(90deg, #8B5CF6, #EC4899, #E8446D, #F59E0B, #10B981, #3B82F6)' }} />
    </div>
  );
};


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 10: IVORY PEARL — Timeless, dignified, serene
   ══════════════════════════════════════════════════════════════ */
const IvoryPearlCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => (
  <div style={{
    width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
    background: 'linear-gradient(160deg, #FAFAF8 0%, #F5F3EE 40%, #FAFAF8 100%)',
    borderRadius: 4, overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 30px rgba(0,0,0,0.06)',
  }}>
    {/* Silver/platinum borders */}
    <div style={{ position: 'absolute', inset: 8, border: '1px solid #C0C0C0', borderRadius: 2 }} />
    <div style={{ position: 'absolute', inset: 13, border: '0.5px solid #C0C0C040' }} />
    {/* Platinum gradient strips */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #C0C0C0, #D8D8D8, #C0C0C0, transparent)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #C0C0C0, #D8D8D8, #C0C0C0, transparent)' }} />
    {/* Scroll corners in silver */}
    <FourCorners offset={4}>
      {() => <ScrollCorner color="#9CA3AF" size={45} />}
    </FourCorners>
    {/* Cross motif at top center */}
    <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)' }}>
      <svg width="20" height="28" viewBox="0 0 20 28">
        <rect x="9" y="0" width="2" height="28" fill="#9CA3AF" opacity={0.3} />
        <rect x="3" y="8" width="14" height="2" fill="#9CA3AF" opacity={0.3} />
      </svg>
    </div>
    {/* Content */}
    <div style={{ position: 'relative', padding: '55px 40px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 10, letterSpacing: 6, color: '#78716C', fontWeight: 500, textTransform: 'uppercase', opacity: 0.8 }}>
        In loving memory
      </p>
      <OrnamentDivider color="#9CA3AF" width={100} variant="dots" />
      <h2 style={{ fontSize: 32, fontWeight: 600, color: '#292524', lineHeight: 1.2, marginBottom: 8, fontStyle: 'italic' }}>{title}</h2>
      {eventType && <p style={{ fontSize: 10, letterSpacing: 5, fontWeight: 500, color: '#78716C', textTransform: 'uppercase', marginBottom: 16 }}>{eventType}</p>}
      <div style={{ margin: '0 auto 16px', width: 40, height: 1, background: '#D6D3D1' }} />
      <div style={{ margin: '8px 0' }}>
        {date && <p style={{ fontSize: 15, fontWeight: 500, color: '#292524', marginBottom: 4 }}>{date}</p>}
        {time && <p style={{ fontSize: 13, color: '#78716C', marginBottom: 4 }}>{time}</p>}
        {venue && <p style={{ fontSize: 13, color: '#78716C' }}>{venue}</p>}
        {dressCode && (
          <span style={{ display: 'inline-block', marginTop: 10, padding: '5px 20px', borderRadius: 100, fontSize: 8, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#78716C', background: '#78716C08', border: '1px solid #78716C15' }}>
            {dressCode}
          </span>
        )}
      </div>
      <QrBlock qrValue={qrValue} accentColor="#78716C" containerBg="#FAFAF8" containerBorder="#D6D3D1" />
      {guestName && (
        <div style={{ margin: '20px 30px 0', paddingTop: 16, borderTop: '1px solid #E7E5E4' }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#292524', fontStyle: 'italic' }}>{guestName}</p>
          <RsvpBadge rsvp={rsvpStatus} />
        </div>
      )}
      <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#A8A29E" />
    </div>
  </div>
);


/* ══════════════════════════════════════════════════════════════
   TEMPLATE 11: CRIMSON DAHLIA SENDOFF — Rich red dahlias,
   gold botanicals, double gold frame, warm cream canvas
   Inspired by luxurious watercolor floral invitation style
   ══════════════════════════════════════════════════════════════ */
const CrimsonDahliaSendoffCard = ({ title, eventType, date, time, venue, dressCode, guestName, rsvpStatus, organizerName, invitationCode, qrValue }: CardTemplateProps) => {
  /* Dahlia flower SVG — large ornamental bloom */
  const Dahlia = ({ size = 90, style }: { size?: number; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      {/* Outer petals — deep crimson */}
      {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map(angle => (
        <ellipse key={`o-${angle}`} cx="50" cy="50" rx="6" ry="22"
          fill="#8B1A1A" opacity={0.9}
          transform={`rotate(${angle} 50 50)`} />
      ))}
      {/* Middle petals — lighter red */}
      {[11, 33, 55, 77, 99, 121, 143, 165, 187, 209, 231, 253, 275, 297, 319, 341].map(angle => (
        <ellipse key={`m-${angle}`} cx="50" cy="50" rx="4.5" ry="16"
          fill="#B22222" opacity={0.85}
          transform={`rotate(${angle} 50 50)`} />
      ))}
      {/* Inner petals — warm red */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
        <ellipse key={`i-${angle}`} cx="50" cy="50" rx="3" ry="10"
          fill="#CD3333" opacity={0.8}
          transform={`rotate(${angle} 50 50)`} />
      ))}
      {/* Center */}
      <circle cx="50" cy="50" r="7" fill="#D4AF37" opacity={0.9} />
      <circle cx="50" cy="50" r="4" fill="#B8860B" opacity={0.7} />
      {/* Gold pollen dots */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <circle key={`p-${angle}`}
          cx={50 + Math.cos(angle * Math.PI / 180) * 9}
          cy={50 + Math.sin(angle * Math.PI / 180) * 9}
          r="1.2" fill="#D4AF37" opacity={0.6} />
      ))}
    </svg>
  );

  /* Gold botanical leaf/branch SVG */
  const GoldBranch = ({ width = 60, flip = false, style }: { width?: number; flip?: boolean; style?: React.CSSProperties }) => (
    <svg width={width} height={width * 1.8} viewBox="0 0 40 72"
      style={{ ...style, transform: flip ? 'scaleX(-1)' : undefined }}>
      {/* Main stem */}
      <path d="M20,0 C20,15 18,30 20,72" stroke="#C5A55A" fill="none" strokeWidth="0.8" opacity={0.6} />
      {/* Leaves */}
      {[8, 20, 32, 44, 56].map((y, i) => (
        <g key={y}>
          <ellipse cx={i % 2 === 0 ? 14 : 26} cy={y} rx="7" ry="4"
            fill="#D4AF37" opacity={0.3 + i * 0.05}
            transform={`rotate(${i % 2 === 0 ? -25 : 25} ${i % 2 === 0 ? 14 : 26} ${y})`} />
        </g>
      ))}
      {/* Gold berries */}
      {[12, 28, 48].map((y, i) => (
        <circle key={`b-${y}`} cx={i % 2 === 0 ? 10 : 30} cy={y} r="2.5"
          fill="#D4AF37" opacity={0.5} />
      ))}
    </svg>
  );

  /* Small gold flower */
  const GoldFlower = ({ size = 30, style }: { size?: number; style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" style={style}>
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map(angle => (
        <ellipse key={angle} cx="15" cy="15" rx="3" ry="8"
          fill="#D4AF37" opacity={0.35}
          transform={`rotate(${angle} 15 15)`} />
      ))}
      <circle cx="15" cy="15" r="3.5" fill="#C5A55A" opacity={0.5} />
      <circle cx="15" cy="15" r="2" fill="#B8860B" opacity={0.4} />
    </svg>
  );

  return (
    <div style={{
      width: 420, margin: '0 auto', fontFamily: "'Cormorant Garamond', Georgia, serif",
      background: 'linear-gradient(170deg, #FDF8EE 0%, #FAF0DC 25%, #FBF5E8 50%, #FAF0DC 75%, #FDF8EE 100%)',
      borderRadius: 4, overflow: 'hidden', position: 'relative',
      boxShadow: '0 8px 40px rgba(139,26,26,0.12), 0 2px 12px rgba(184,134,11,0.08)',
    }}>
      {/* Warm glow overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at top right, rgba(212,175,55,0.08) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(212,175,55,0.06) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />
      {/* Subtle mandala pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'radial-gradient(circle, #B8860B 1px, transparent 1px)',
        backgroundSize: '20px 20px', pointerEvents: 'none',
      }} />

      {/* === OUTER GOLD FRAME === */}
      <div style={{
        position: 'absolute', inset: 8,
        border: '2px solid #C5A55A',
        borderRadius: 2, pointerEvents: 'none',
      }} />
      {/* === INNER GOLD FRAME === */}
      <div style={{
        position: 'absolute', inset: 14,
        border: '1px solid #D4AF3740',
        borderRadius: 1, pointerEvents: 'none',
      }} />

      {/* Gold sparkle dots scattered */}
      {[
        { top: '12%', left: '35%' }, { top: '8%', right: '30%' },
        { top: '45%', left: '8%' }, { top: '50%', right: '10%' },
        { bottom: '15%', left: '25%' }, { bottom: '20%', right: '35%' },
        { top: '25%', right: '15%' }, { bottom: '35%', left: '12%' },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 3 + (i % 3), height: 3 + (i % 3), borderRadius: '50%',
          background: '#D4AF37', opacity: 0.2 + (i % 4) * 0.08,
          pointerEvents: 'none',
        }} />
      ))}

      {/* ═══ TOP-LEFT: Large Dahlia + Gold Flowers ═══ */}
      <Dahlia size={110} style={{ position: 'absolute', top: -15, left: -15 }} />
      <Dahlia size={55} style={{ position: 'absolute', top: 65, left: 55, opacity: 0.7 }} />
      <GoldFlower size={40} style={{ position: 'absolute', top: 20, left: 85 }} />
      <GoldFlower size={28} style={{ position: 'absolute', top: 80, left: 15, opacity: 0.5 }} />
      <GoldBranch width={30} style={{ position: 'absolute', top: 15, left: 110, opacity: 0.6 }} />

      {/* ═══ TOP-RIGHT: Gold Flowers + Branch ═══ */}
      <GoldFlower size={50} style={{ position: 'absolute', top: -5, right: 20, opacity: 0.6 }} />
      <GoldFlower size={35} style={{ position: 'absolute', top: 35, right: 5, opacity: 0.45 }} />
      <GoldBranch width={25} flip style={{ position: 'absolute', top: 60, right: 30, opacity: 0.5 }} />

      {/* ═══ RIGHT EDGE: Small branch ═══ */}
      <GoldBranch width={20} flip style={{ position: 'absolute', top: '40%', right: 12, opacity: 0.35 }} />
      <Dahlia size={40} style={{ position: 'absolute', top: '48%', right: -5, opacity: 0.5 }} />

      {/* ═══ BOTTOM-RIGHT: Large Dahlia + Accents ═══ */}
      <Dahlia size={100} style={{ position: 'absolute', bottom: -12, right: -12 }} />
      <Dahlia size={50} style={{ position: 'absolute', bottom: 60, right: 55, opacity: 0.6 }} />
      <GoldFlower size={35} style={{ position: 'absolute', bottom: 15, right: 80, opacity: 0.5 }} />
      <GoldBranch width={25} style={{ position: 'absolute', bottom: 20, right: 100, opacity: 0.5 }} />

      {/* ═══ BOTTOM-LEFT: Small Dahlia + Gold ═══ */}
      <Dahlia size={45} style={{ position: 'absolute', bottom: -5, left: 10, opacity: 0.5 }} />
      <GoldFlower size={30} style={{ position: 'absolute', bottom: 30, left: 50, opacity: 0.4 }} />
      <GoldBranch width={22} style={{ position: 'absolute', bottom: 50, left: 5, opacity: 0.4 }} />

      {/* ═══ CONTENT ═══ */}
      <div style={{ position: 'relative', padding: '100px 50px 0', textAlign: 'center' }}>
        {/* "Save the Date" style header */}
        <p style={{
          fontSize: 11, letterSpacing: 5, color: '#8B1A1A', fontWeight: 600,
          textTransform: 'uppercase', opacity: 0.8, marginBottom: 6,
        }}>
          You are cordially invited
        </p>

        {/* Ornamental divider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px auto', width: 160 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C5A55A)' }} />
          <div style={{ margin: '0 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 3, height: 3, transform: 'rotate(45deg)', background: '#C5A55A', opacity: 0.5 }} />
            <div style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: '#D4AF37' }} />
            <div style={{ width: 3, height: 3, transform: 'rotate(45deg)', background: '#C5A55A', opacity: 0.5 }} />
          </div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C5A55A)' }} />
        </div>

        {/* Event Type Tag */}
        {eventType && (
          <span style={{
            display: 'inline-block', padding: '5px 22px', borderRadius: 100,
            background: 'linear-gradient(135deg, #8B1A1A12, #D4AF3712)',
            fontSize: 9, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
            color: '#8B1A1A', border: '1px solid #C5A55A30', marginBottom: 12,
          }}>
            {eventType}
          </span>
        )}

        {/* Main Title */}
        <h2 style={{
          fontSize: 38, fontWeight: 700, color: '#1A0A05', lineHeight: 1.15,
          margin: '8px 0 6px', letterSpacing: -0.5,
          textShadow: '0 1px 2px rgba(139,26,26,0.06)',
        }}>
          {title}
        </h2>

        {/* Scroll divider */}
        <svg width="80" height="14" viewBox="0 0 80 14" style={{ display: 'block', margin: '10px auto 18px' }}>
          <path d="M0,7 C12,0 22,0 30,7 C38,14 48,14 56,7 C64,0 72,0 80,7"
            stroke="#C5A55A" fill="none" strokeWidth="1" opacity={0.5} />
        </svg>

        {/* Event Details */}
        <div style={{ margin: '0 0 8px' }}>
          {date && (
            <p style={{
              fontSize: 15, fontWeight: 700, color: '#1A0A05', marginBottom: 3,
              letterSpacing: 1,
            }}>{date}</p>
          )}
          {time && (
            <p style={{ fontSize: 13, color: '#5C3A2A', marginBottom: 3, fontWeight: 500 }}>
              {time}
            </p>
          )}
          {venue && (
            <p style={{ fontSize: 13, color: '#5C3A2A', fontWeight: 500 }}>{venue}</p>
          )}
          {dressCode && (
            <span style={{
              display: 'inline-block', marginTop: 12, padding: '5px 22px', borderRadius: 100,
              fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
              color: '#8B1A1A', background: '#8B1A1A08', border: '1px solid #8B1A1A20',
            }}>
              {dressCode}
            </span>
          )}
        </div>

        {/* QR Code */}
        <QrBlock qrValue={qrValue} accentColor="#8B1A1A" fgColor="#1A0A05"
          containerBg="rgba(255,253,248,0.7)" containerBorder="#C5A55A30" />

        {/* Guest Name */}
        {guestName && (
          <div style={{
            margin: '20px 30px 0', paddingTop: 16,
            borderTop: '1px solid #C5A55A35',
          }}>
            <p style={{ fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#8B1A1A', fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
              Special Invite
            </p>
            <p style={{
              fontSize: 24, fontWeight: 700, color: '#1A0A05',
              fontStyle: 'italic',
            }}>{guestName}</p>
            <RsvpBadge rsvp={rsvpStatus} />
          </div>
        )}

        <FooterBlock organizerName={organizerName} invitationCode={invitationCode} color="#9C8872" />
      </div>
    </div>
  );
};


/* ──────────────────────────────────────
   TEMPLATE REGISTRY & MAPPING
   ────────────────────────────────────── */

export const CARD_TEMPLATES: Record<string, { component: React.FC<CardTemplateProps>; label: string }> = {
  'royal-gold': { component: RoyalGoldCard, label: 'Royal Gold' },
  'crimson-rose': { component: CrimsonRoseCard, label: 'Crimson Rose' },
  'sapphire-night': { component: SapphireNightCard, label: 'Sapphire Night' },
  'blush-garden': { component: BlushGardenCard, label: 'Blush Garden' },
  'emerald-crown': { component: EmeraldCrownCard, label: 'Emerald Crown' },
  'amber-heritage': { component: AmberHeritageCard, label: 'Amber Heritage' },
  'violet-dynasty': { component: VioletDynastyCard, label: 'Violet Dynasty' },
  'noir-gold': { component: NoirGoldCard, label: 'Noir & Gold' },
  'tropical-celebration': { component: TropicalCelebrationCard, label: 'Tropical Celebration' },
  'ivory-pearl': { component: IvoryPearlCard, label: 'Ivory Pearl' },
  'crimson-dahlia-sendoff': { component: CrimsonDahliaSendoffCard, label: 'Crimson Dahlia Sendoff' },
};

/** Map event type to the best default template */
const EVENT_TYPE_DEFAULTS: Record<string, string> = {
  wedding: 'royal-gold',
  birthday: 'tropical-celebration',
  corporate: 'noir-gold',
  memorial: 'ivory-pearl',
  anniversary: 'blush-garden',
  conference: 'sapphire-night',
  graduation: 'emerald-crown',
  sendoff: 'crimson-dahlia-sendoff',
};

/** Get the card component for a given event type (normalized key) */
export function getCardComponent(typeKey: string): React.FC<CardTemplateProps> {
  const templateId = EVENT_TYPE_DEFAULTS[typeKey] || 'royal-gold';
  return CARD_TEMPLATES[templateId]?.component || RoyalGoldCard;
}

/** Get template ID for event type */
export function getDefaultTemplateId(typeKey: string): string {
  return EVENT_TYPE_DEFAULTS[typeKey] || 'royal-gold';
}

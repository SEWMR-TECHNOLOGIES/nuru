import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { post } from '@/lib/api/helpers';

const getDeviceType = (): string => {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
};

const getBrowser = (): string => {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
};

let visitorId = localStorage.getItem('nuru_visitor_id');
if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem('nuru_visitor_id', visitorId);
}

let sessionId = sessionStorage.getItem('nuru_session_id');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  sessionStorage.setItem('nuru_session_id', sessionId);
}

export const usePageTracking = () => {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/admin') || path === lastPath.current) return;
    lastPath.current = path;

    // Track via backend API — fire and forget
    post('/analytics/page-views', {
      path,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      device_type: getDeviceType(),
      browser: getBrowser(),
      session_id: sessionId,
      visitor_id: visitorId,
    }).catch(() => { /* silent */ });
  }, [location.pathname]);
};

import { useState, useEffect, useCallback } from 'react';
import { eventsApi, EventPermissions } from '@/lib/api/events';

const ALL_PERMISSIONS: EventPermissions = {
  is_creator: false,
  role: null,
  can_view_guests: false,
  can_manage_guests: false,
  can_send_invitations: false,
  can_check_in_guests: false,
  can_view_budget: false,
  can_manage_budget: false,
  can_view_contributions: false,
  can_manage_contributions: false,
  can_view_vendors: false,
  can_manage_vendors: false,
  can_approve_bookings: false,
  can_edit_event: false,
  can_manage_committee: false,
  can_view_expenses: false,
  can_manage_expenses: false,
};

const CREATOR_PERMISSIONS: EventPermissions = {
  is_creator: true,
  role: 'creator',
  can_view_guests: true,
  can_manage_guests: true,
  can_send_invitations: true,
  can_check_in_guests: true,
  can_view_budget: true,
  can_manage_budget: true,
  can_view_contributions: true,
  can_manage_contributions: true,
  can_view_vendors: true,
  can_manage_vendors: true,
  can_approve_bookings: true,
  can_edit_event: true,
  can_manage_committee: true,
  can_view_expenses: true,
  can_manage_expenses: true,
};

const _permissionsCache = new Map<string, EventPermissions>();

export const useEventPermissions = (eventId: string | null) => {
  const cached = eventId ? _permissionsCache.get(eventId) : null;
  const [permissions, setPermissions] = useState<EventPermissions>(cached || ALL_PERMISSIONS);
  const [loading, setLoading] = useState(!cached);

  const fetchPermissions = useCallback(async () => {
    if (!eventId) return;
    if (!_permissionsCache.has(eventId)) setLoading(true);
    try {
      const res = await eventsApi.getMyPermissions(eventId);
      if (res.success) {
        _permissionsCache.set(eventId, res.data);
        setPermissions(res.data);
      }
    } catch {
      // Silent - defaults to no permissions
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchPermissions();
  }, [fetchPermissions, eventId]);

  return { permissions, loading, refetch: fetchPermissions };
};

export type { EventPermissions };
export { ALL_PERMISSIONS, CREATOR_PERMISSIONS };

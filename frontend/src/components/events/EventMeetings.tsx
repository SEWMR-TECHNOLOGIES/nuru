import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Users, Clock, Play, Square, Trash2, Loader2, UserPlus, Calendar, Check, Link2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { meetingsApi, Meeting } from '@/lib/api/meetings';
import { eventsApi, showCaughtError } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { format } from 'date-fns';

interface EventMeetingsProps {
  eventId: string;
  isCreator: boolean;
}

const EventMeetings = ({ eventId, isCreator }: EventMeetingsProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('60');
  const [committeeMembers, setCommitteeMembers] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const loadMeetings = useCallback(async () => {
    try {
      const res = await meetingsApi.list(eventId);
      if (res.success) setMeetings((res.data as Meeting[]) || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [eventId]);

  const loadCommittee = useCallback(async () => {
    try {
      const res = await eventsApi.getCommittee(eventId);
      if (res.success) {
        const data = res.data as any;
        setCommitteeMembers(Array.isArray(data) ? data : data?.members || []);
      }
    } catch { /* silent */ }
  }, [eventId]);

  useEffect(() => {
    loadMeetings();
    loadCommittee();
  }, [loadMeetings, loadCommittee]);

  const handleCreate = async () => {
    if (!title.trim() || !scheduledAt) {
      toast.error(t('enter_title_time'));
      return;
    }
    setCreating(true);
    try {
      const res = await meetingsApi.create(eventId, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        participant_user_ids: selectedParticipants,
      });
      if (res.success) {
        toast.success(res.message || t('meeting_scheduled'));
        setShowCreate(false);
        setTitle(''); setDescription(''); setScheduledAt(''); setDuration('60'); setSelectedParticipants([]);
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setCreating(false); }
  };

  const handleJoin = async (meeting: Meeting) => {
    try {
      const res = await meetingsApi.join(eventId, meeting.id);
      if (res.success) {
        const joinData = res.data as { room_id: string; meeting_url: string; title: string };
        navigate(`/meet/${joinData.room_id}`);
      }
    } catch (err: any) { showCaughtError(err); }
  };

  const handleEnd = async (meetingId: string) => {
    try {
      const res = await meetingsApi.end(eventId, meetingId);
      if (res.success) {
        toast.success(t('meeting_ended'));
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
  };

  const handleDelete = async (meetingId: string) => {
    try {
      const res = await meetingsApi.delete(eventId, meetingId);
      if (res.success) {
        toast.success(t('meeting_cancelled'));
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
  };

  const handleCopyLink = (meeting: Meeting) => {
    const link = `${window.location.origin}/meet/${meeting.room_id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(meeting.id);
    toast.success(t('meeting_link_copied'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">{t('status_scheduled')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 animate-pulse font-semibold">{t('status_live')}</Badge>;
      case 'ended':
        return <Badge variant="secondary" className="font-medium">{t('status_ended')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-bold flex items-center gap-2.5 tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            {t('meetings')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('meetings_subtitle')}</p>
        </div>
        {isCreator && (
          <Button onClick={() => { setShowCreate(true); loadCommittee(); }} className="gap-2 rounded-xl shadow-sm">
            <Plus className="w-4 h-4" /> {t('schedule_meeting')}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Video className="w-10 h-10 text-primary" />
            </div>
            <h4 className="font-bold text-xl mb-2 tracking-tight">{t('no_meetings_yet')}</h4>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
              {t('no_meetings_desc')}
            </p>
            {isCreator && (
              <Button className="mt-6 gap-2 rounded-xl" onClick={() => { setShowCreate(true); loadCommittee(); }}>
                <Sparkles className="w-4 h-4" /> {t('schedule_first_meeting')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className={`group transition-all duration-200 hover:shadow-lg rounded-2xl overflow-hidden ${
              meeting.status === 'in_progress' 
                ? 'ring-2 ring-emerald-500/40 shadow-emerald-500/10 shadow-md' 
                : 'hover:border-primary/20'
            }`}>
              {meeting.status === 'in_progress' && (
                <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
              )}
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Left icon */}
                  <div className={`hidden sm:flex w-12 h-12 rounded-xl items-center justify-center flex-shrink-0 ${
                    meeting.status === 'in_progress'
                      ? 'bg-emerald-100 dark:bg-emerald-950'
                      : meeting.status === 'ended'
                        ? 'bg-muted'
                        : 'bg-primary/10'
                  }`}>
                    <Video className={`w-6 h-6 ${
                      meeting.status === 'in_progress'
                        ? 'text-emerald-600'
                        : meeting.status === 'ended'
                          ? 'text-muted-foreground'
                          : 'text-primary'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-semibold text-base tracking-tight">{meeting.title}</h4>
                          {getStatusBadge(meeting.status)}
                        </div>
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{meeting.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(meeting.scheduled_at), 'MMM d, yyyy · h:mm a')}
                      </span>
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" />
                        {meeting.duration_minutes} {t('min_suffix')}
                      </span>
                      <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                        <Users className="w-3.5 h-3.5" />
                        {meeting.participant_count} {meeting.participant_count !== 1 ? t('participants') : t('participant')}
                      </span>
                    </div>

                    {/* Participants */}
                    {meeting.participants.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2">
                          {meeting.participants.slice(0, 6).map((p) => (
                            <Avatar key={p.id} className="w-8 h-8 border-2 border-background ring-1 ring-border/50">
                              <AvatarImage src={p.avatar_url || ''} />
                              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">{p.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {meeting.participant_count > 6 && (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold border-2 border-background">
                              +{meeting.participant_count - 6}
                            </div>
                          )}
                        </div>
                        {meeting.created_by && (
                          <span className="text-xs text-muted-foreground">{t('created_by')} {meeting.created_by.name}</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {meeting.status !== 'ended' && (
                        <Button size="sm" className="gap-1.5 rounded-xl shadow-sm" onClick={() => handleJoin(meeting)}>
                          <Play className="w-3.5 h-3.5" />
                          {meeting.status === 'in_progress' ? t('join_now') : t('join_meeting')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => handleCopyLink(meeting)}>
                        {copiedId === meeting.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                        {copiedId === meeting.id ? t('copied') : t('copy_link')}
                      </Button>
                      {isCreator && meeting.status !== 'ended' && (
                        <>
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => handleEnd(meeting.id)}>
                            <Square className="w-3.5 h-3.5" /> {t('end_meeting')}
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => { setShowAddPeople(meeting.id); loadCommittee(); }}>
                            <UserPlus className="w-3.5 h-3.5" /> {t('add_people')}
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl text-destructive hover:text-destructive" onClick={() => handleDelete(meeting.id)}>
                            <Trash2 className="w-3.5 h-3.5" /> {t('cancel')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create meeting dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="w-4 h-4 text-primary" />
              </div>
              {t('schedule_a_meeting')}
            </DialogTitle>
            <DialogDescription className="text-sm">{t('meeting_invite_subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('meeting_title')}</Label>
              <Input className="rounded-xl" placeholder={t('meeting_title_placeholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('meeting_description')}</Label>
              <Textarea className="rounded-xl resize-none" placeholder={t('meeting_description_placeholder')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('date_and_time')}</Label>
                <Input className="rounded-xl" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('duration_minutes')}</Label>
                <Input className="rounded-xl" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="15" max="480" />
              </div>
            </div>
            {committeeMembers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('invite_committee')}</Label>
                <ScrollArea className="h-48 border rounded-xl p-2">
                  {committeeMembers.map((m: any) => {
                    const uid = m.user_id || m.id;
                    const name = m.user_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
                    return (
                      <label key={uid} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors">
                        <Checkbox
                          checked={selectedParticipants.includes(uid)}
                          onCheckedChange={(checked) => {
                            setSelectedParticipants(prev =>
                              checked ? [...prev, uid] : prev.filter(id => id !== uid)
                            );
                          }}
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={m.avatar_url || ''} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{(name || '?').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {m.role_name && <p className="text-xs text-muted-foreground">{m.role_name}</p>}
                        </div>
                      </label>
                    );
                  })}
                </ScrollArea>
                {selectedParticipants.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedParticipants.length} {t('selected_count')}</p>
                )}
              </div>
            )}
            <Button className="w-full rounded-xl h-11 font-semibold" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
              {t('schedule_meeting')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add participants dialog */}
      <AddParticipantsDialog
        open={!!showAddPeople}
        onClose={() => setShowAddPeople(null)}
        eventId={eventId}
        meetingId={showAddPeople || ''}
        committeeMembers={committeeMembers}
        existingMeeting={meetings.find(m => m.id === showAddPeople)}
        onSuccess={loadMeetings}
      />
    </div>
  );
};

// ── Add Participants Dialog ──
function AddParticipantsDialog({ open, onClose, eventId, meetingId, committeeMembers, existingMeeting, onSuccess }: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  meetingId: string;
  committeeMembers: any[];
  existingMeeting?: Meeting;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const existingIds = new Set(existingMeeting?.participants.map(p => p.user_id) || []);

  const handleAdd = async () => {
    if (!selected.length) return;
    setAdding(true);
    try {
      const res = await meetingsApi.addParticipants(eventId, meetingId, selected);
      if (res.success) {
        toast.success(res.message || t('participants_added'));
        setSelected([]);
        onClose();
        onSuccess();
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setAdding(false); }
  };

  const available = committeeMembers.filter(m => !existingIds.has(m.user_id || m.id));

  return (
    <Dialog open={open} onOpenChange={() => { setSelected([]); onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('add_people_to_meeting')}
          </DialogTitle>
          <DialogDescription className="text-sm">{t('add_people_desc')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-64 border rounded-xl p-2">
          {available.map((m: any) => {
            const uid = m.user_id || m.id;
            const name = m.user_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
            return (
              <label key={uid} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors">
                <Checkbox
                  checked={selected.includes(uid)}
                  onCheckedChange={(checked) => {
                    setSelected(prev => checked ? [...prev, uid] : prev.filter(id => id !== uid));
                  }}
                />
                <Avatar className="w-8 h-8">
                  <AvatarImage src={m.avatar_url || ''} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{(name || '?').charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{name}</span>
              </label>
            );
          })}
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('all_members_added')}</p>
          )}
        </ScrollArea>
        <Button className="w-full rounded-xl h-11 font-semibold" onClick={handleAdd} disabled={adding || !selected.length}>
          {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          {t('add_participants_btn')} ({selected.length})
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default EventMeetings;
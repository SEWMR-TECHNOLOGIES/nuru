import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, Play, Square, Trash2, Loader2, UserPlus, CalendarIcon, Check, Link2, Sparkles, ListOrdered, ChevronRight, ChevronLeft } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { meetingsApi, Meeting } from '@/lib/api/meetings';
import { eventsApi, showCaughtError } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import SvgIcon from '@/components/ui/svg-icon';
import videoChatIcon from '@/assets/video-chat-icon.svg';
import MeetingDocuments from '@/components/events/MeetingDocuments';

interface EventMeetingsProps {
  eventId: string;
  isCreator: boolean;
  eventName?: string;
}

const DURATIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const EventMeetings = ({ eventId, isCreator, eventName }: EventMeetingsProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMeetingDocs, setSelectedMeetingDocs] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // -- Create form state --
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
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

  const resetForm = () => {
    setStep(1);
    setTitle(''); setDescription(''); setSelectedDate(undefined);
    setSelectedHour('09'); setSelectedMinute('00'); setDuration('60');
    setSelectedParticipants([]);
  };

  const handleCreate = async () => {
    if (!title.trim() || !selectedDate) {
      toast.error(t('enter_title_time'));
      return;
    }
    const scheduled = new Date(selectedDate);
    scheduled.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setCreating(true);
    try {
      const res = await meetingsApi.create(eventId, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduled.toISOString(),
        timezone: userTimezone,
        duration_minutes: duration,
        participant_user_ids: selectedParticipants,
      });
      if (res.success) {
        toast.success(res.message || t('meeting_scheduled'));
        setShowCreate(false);
        resetForm();
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setCreating(false); }
  };

  const handleJoin = async (meeting: Meeting) => {
    setJoiningId(meeting.id);
    try {
      const res = await meetingsApi.join(eventId, meeting.id);
      if (res.success) {
        const joinData = res.data as { room_id: string; meeting_url: string; title: string };
        navigate(`/meet/${joinData.room_id}?eventId=${eventId}&meetingId=${meeting.id}`);
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setJoiningId(null); }
  };

  const handleEnd = async (meetingId: string) => {
    setEndingId(meetingId);
    try {
      const res = await meetingsApi.end(eventId, meetingId);
      if (res.success) {
        toast.success(t('meeting_ended'));
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setEndingId(null); }
  };

  const handleDelete = async (meetingId: string) => {
    setDeletingId(meetingId);
    try {
      const res = await meetingsApi.delete(eventId, meetingId);
      if (res.success) {
        toast.success(t('meeting_cancelled'));
        loadMeetings();
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setDeletingId(null); }
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
              <SvgIcon src={videoChatIcon} className="w-5 h-5" />
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
              <SvgIcon src={videoChatIcon} className="w-10 h-10" />
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
                    <SvgIcon src={videoChatIcon} className="w-6 h-6" />
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
                        <CalendarIcon className="w-3.5 h-3.5" />
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
                        <Button size="sm" className="gap-1.5 rounded-xl shadow-sm" onClick={() => handleJoin(meeting)} disabled={joiningId === meeting.id}>
                          {joiningId === meeting.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          {meeting.status === 'in_progress' ? t('join_now') : t('join_meeting')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => handleCopyLink(meeting)}>
                        {copiedId === meeting.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                        {copiedId === meeting.id ? t('copied') : t('copy_link')}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setSelectedMeetingDocs(selectedMeetingDocs === meeting.id ? null : meeting.id)}>
                        <ListOrdered className="w-3.5 h-3.5" /> {t('agenda_minutes')}
                        {(meeting.has_agenda || meeting.has_minutes) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </Button>
                      {isCreator && meeting.status === 'in_progress' && (
                        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => handleEnd(meeting.id)} disabled={endingId === meeting.id}>
                          {endingId === meeting.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                          {t('end_meeting')}
                        </Button>
                      )}
                      {isCreator && meeting.status !== 'ended' && (
                        <>
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => { setShowAddPeople(meeting.id); loadCommittee(); }}>
                            <UserPlus className="w-3.5 h-3.5" /> {t('add_people')}
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl text-destructive hover:text-destructive" onClick={() => handleDelete(meeting.id)} disabled={deletingId === meeting.id}>
                            {deletingId === meeting.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            {t('cancel')}
                          </Button>
                        </>
                      )}
                    </div>
                    {/* Agenda & Minutes Panel */}
                    {selectedMeetingDocs === meeting.id && (
                      <div className="mt-4 pt-4 border-t">
                        <MeetingDocuments
                          eventId={eventId}
                          meetingId={meeting.id}
                          meetingTitle={meeting.title}
                          meetingDescription={meeting.description}
                          meetingDate={meeting.scheduled_at}
                          isCreator={isCreator}
                          eventName={eventName}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create meeting dialog – 2-step wizard */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
          {/* Progress indicator */}
          <div className="flex gap-1.5 px-6 pt-5">
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-300", "bg-primary")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-300", step >= 2 ? "bg-primary" : "bg-muted")} />
          </div>

          <div className="px-6 pb-6 pt-3">
            <DialogHeader className="space-y-1.5 mb-5">
              <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <SvgIcon src={videoChatIcon} className="w-4.5 h-4.5" />
                </div>
                {step === 1 ? t('schedule_a_meeting') : t('date_and_time')}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {step === 1 ? t('meeting_invite_subtitle') : 'Choose when your meeting takes place.'}
              </DialogDescription>
            </DialogHeader>

            {step === 1 ? (
              /* ── STEP 1: Title, Description, Participants ── */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('meeting_title')}</Label>
                  <Input
                    className="rounded-xl h-11"
                    placeholder={t('meeting_title_placeholder')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('meeting_description')}</Label>
                  <Textarea
                    className="rounded-xl resize-none"
                    placeholder={t('meeting_description_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {committeeMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t('invite_committee')}</Label>
                    <ScrollArea className="h-44 border rounded-xl p-1.5">
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

                <Button
                  className="w-full rounded-xl h-11 font-semibold gap-2"
                  onClick={() => {
                    if (!title.trim()) { toast.error(t('enter_title_time')); return; }
                    setStep(2);
                  }}
                >
                  {t('date_and_time')} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* ── STEP 2: Date, Time, Duration ── */
              <div className="space-y-5">
                {/* Date picker */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('pick_date')}</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl h-11", !selectedDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'EEEE, MMM d, yyyy') : t('pick_date')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => { setSelectedDate(date); setDatePickerOpen(false); }}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time picker – scrollable wheels */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('pick_time')}</Label>
                  <div className="flex items-center gap-0 bg-muted/40 rounded-2xl p-3 border">
                    {/* Hour wheel */}
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center mb-2">Hour</p>
                      <div className="grid grid-cols-6 gap-1">
                        {HOURS.map(h => (
                          <button
                            key={h}
                            onClick={() => setSelectedHour(h)}
                            className={cn(
                              "h-8 rounded-lg text-sm font-medium transition-all",
                              selectedHour === h
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-muted text-foreground"
                            )}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Separator */}
                    <div className="w-px h-24 bg-border mx-3 self-center" />
                    {/* Minute wheel */}
                    <div className="w-20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center mb-2">Min</p>
                      <div className="grid grid-cols-1 gap-1">
                        {MINUTES.map(m => (
                          <button
                            key={m}
                            onClick={() => setSelectedMinute(m)}
                            className={cn(
                              "h-9 rounded-lg text-sm font-medium transition-all",
                              selectedMinute === m
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-muted text-foreground"
                            )}
                          >
                            :{m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Selected time preview */}
                  <p className="text-center text-lg font-bold tracking-tight text-foreground">
                    {selectedHour}:{selectedMinute}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </span>
                  </p>
                </div>

                {/* Duration chips */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t('duration_minutes')}</Label>
                  <div className="flex gap-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDuration(d.value)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                          duration === d.value
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background hover:bg-muted border-border text-foreground"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="rounded-xl h-11 px-5" onClick={() => setStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button className="flex-1 rounded-xl h-11 font-semibold gap-2" onClick={handleCreate} disabled={creating || !selectedDate}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <SvgIcon src={videoChatIcon} className="w-4 h-4" />}
                    {t('schedule_meeting')}
                  </Button>
                </div>
              </div>
            )}
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
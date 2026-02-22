import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Plus, CheckCircle2, Circle, Clock, SkipForward, Trash2,
  ChevronDown, ChevronUp, FileText, Loader2, LayoutTemplate, CalendarIcon, Search, X
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useEventChecklist, useEventTemplates } from "@/data/useChecklist";
import { eventsApi } from "@/lib/api/events";
import type { ChecklistItem } from "@/lib/api/templates";
import { toast } from "sonner";
import { showCaughtError } from "@/lib/api";
import type { EventPermissions } from "@/lib/api/events";

interface AssignableMember {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar?: string;
  role: string;
}

interface EventChecklistProps {
  eventId: string;
  eventTypeId?: string;
  permissions: EventPermissions;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Clock className="w-4 h-4 text-amber-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  skipped: <SkipForward className="w-4 h-4 text-muted-foreground/50" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const CATEGORIES = [
  "Venue", "Catering", "Decorations", "Photography", "Music & Entertainment",
  "Invitations", "Transport", "Attire", "Budget", "Coordination", "Other"
];

const EventChecklist: React.FC<EventChecklistProps> = ({ eventId, eventTypeId, permissions }) => {
  const { items, summary, loading, addItem, updateItem, deleteItem, applyTemplate } = useEventChecklist(eventId);
  const { templates, loading: templatesLoading } = useEventTemplates(eventTypeId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [addForm, setAddForm] = useState({
    title: "", description: "", category: "", priority: "medium" as "high" | "medium" | "low",
    due_date: null as Date | null, assigned_to: "", notes: "",
  });
  const [selectedAssignee, setSelectedAssignee] = useState<AssignableMember | null>(null);
  const [assignableMembers, setAssignableMembers] = useState<AssignableMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const fetchAssignableMembers = useCallback(async () => {
    if (!eventId) return;
    setMembersLoading(true);
    try {
      const res = await eventsApi.getAssignableMembers(eventId);
      if (res.success) setAssignableMembers(res.data);
    } catch { /* silent */ }
    finally { setMembersLoading(false); }
  }, [eventId]);

  // Only fetch when user starts typing (not on mount)
  useEffect(() => {
    if (memberSearch.trim().length >= 1 && assignableMembers.length === 0) {
      fetchAssignableMembers();
    }
  }, [memberSearch, assignableMembers.length, fetchAssignableMembers]);

  const filteredMembers = memberSearch.trim()
    ? assignableMembers.filter(m =>
        m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.role.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

  const canEdit = permissions.can_edit_event || permissions.is_creator;

  const handleAddItem = async () => {
    if (!addForm.title.trim()) return;
    setAddLoading(true);
    try {
      await addItem({
        ...addForm,
        due_date: addForm.due_date ? format(addForm.due_date, "yyyy-MM-dd") : undefined,
        assigned_to: addForm.assigned_to.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
        description: addForm.description.trim() || undefined,
      });
      toast.success("Checklist item added");
      setShowAddDialog(false);
      setAddForm({ title: "", description: "", category: "", priority: "medium" as const, due_date: null, assigned_to: "", notes: "" });
      setSelectedAssignee(null);
      setMemberSearch("");
    } catch (err: any) {
      showCaughtError(err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleStatusToggle = async (item: ChecklistItem) => {
    if (!canEdit) return;
    const statusCycle: Record<string, string> = {
      pending: "in_progress", in_progress: "completed", completed: "pending", skipped: "pending",
    };
    const newStatus = statusCycle[item.status] || "pending";
    try {
      await updateItem(item.id, { status: newStatus } as any);
    } catch (err: any) {
      showCaughtError(err);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    setApplying(true);
    try {
      const result = await applyTemplate(templateId, items.length === 0);
      toast.success(`${result?.added || 0} tasks added from template`);
      setShowTemplateDialog(false);
    } catch (err: any) {
      showCaughtError(err);
    } finally {
      setApplying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem(deleteItemId);
      toast.success("Item removed");
    } catch (err: any) {
      showCaughtError(err);
    }
    setDeleteItemId(null);
  };

  const filteredItems = filterCategory === "all"
    ? items
    : items.filter(i => i.category === filterCategory);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Progress skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-md bg-muted/50 p-2 flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Items skeleton */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-lg border p-3 flex items-start gap-3">
                <Skeleton className="h-4 w-4 mt-0.5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {summary && summary.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Checklist Progress</p>
              <p className="text-sm font-semibold text-primary">{summary.progress_percentage}%</p>
            </div>
            <Progress value={summary.progress_percentage} className="h-2 mb-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-lg font-semibold text-green-600">{summary.completed}</p>
                <p className="text-[10px] text-muted-foreground">Done</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-lg font-semibold text-amber-600">{summary.in_progress}</p>
                <p className="text-[10px] text-muted-foreground">In Progress</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-lg font-semibold">{summary.pending}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Planning Checklist</CardTitle>
          <div className="flex gap-2">
            {canEdit && templates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTemplateDialog(true)}>
                <FileText className="w-4 h-4 mr-1" />Use Template
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />Add Task
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              <Button size="sm" variant={filterCategory === "all" ? "default" : "outline"} className="text-xs h-7" onClick={() => setFilterCategory("all")}>All</Button>
              {categories.map(cat => (
                <Button key={cat} size="sm" variant={filterCategory === cat ? "default" : "outline"} className="text-xs h-7 whitespace-nowrap" onClick={() => setFilterCategory(cat!)}>{cat}</Button>
              ))}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium mb-1">No checklist items yet</p>
                  <p className="text-sm">
                    {templates.length > 0
                      ? 'Choose a template below to get started, or add tasks manually.'
                      : 'Add tasks to track your event planning progress.'}
                  </p>
                </div>

                {/* Inline template cards when checklist is empty */}
                {!templatesLoading && templates.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <LayoutTemplate className="w-4 h-4" /> Available Templates
                    </p>
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleApplyTemplate(template.id)}
                        disabled={applying}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{template.name}</p>
                            {template.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
                            {template.task_count} tasks
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {templatesLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    {[1, 2].map(i => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              filteredItems.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border transition-colors ${
                      item.status === "completed"
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : item.status === "in_progress"
                        ? "bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800"
                        : item.status === "skipped"
                        ? "bg-muted/30 border-border"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      {canEdit && (
                        <button
                          onClick={() => handleStatusToggle(item)}
                          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                          title={`Click to change status (${STATUS_LABELS[item.status]})`}
                        >
                          {STATUS_ICONS[item.status]}
                        </button>
                      )}
                      {!canEdit && <div className="mt-0.5 flex-shrink-0">{STATUS_ICONS[item.status]}</div>}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="text-muted-foreground hover:text-foreground">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.category && (
                            <Badge variant="outline" className="text-[10px] h-5">{item.category}</Badge>
                          )}
                          <Badge className={`text-[10px] h-5 border ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</Badge>
                          {item.due_date && (
                            <span className="text-[10px] text-muted-foreground">
                              Due: {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {item.assigned_name && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Avatar className="w-4 h-4">
                                {item.assigned_avatar ? (
                                  <AvatarImage src={item.assigned_avatar} alt={item.assigned_name} />
                                ) : null}
                                <AvatarFallback className="text-[6px] bg-primary/10 text-primary">
                                  {item.assigned_name.split(" ").map(n => n.charAt(0)).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              {item.assigned_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/50">
                        <div className="pl-7 space-y-2 mt-2">
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-muted-foreground italic">Notes: {item.notes}</p>
                          )}
                          {canEdit && (
                            <div className="flex gap-2 mt-2">
                              <Select
                                value={item.status}
                                onValueChange={async (val) => {
                                  try { await updateItem(item.id, { status: val } as any); } catch (err: any) { showCaughtError(err); }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="skipped">Skipped</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => setDeleteItemId(item.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Checklist Item</DialogTitle>
            <DialogDescription>Add a new task to your event planning checklist</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input placeholder="e.g. Book venue" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea placeholder="Details..." value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={addForm.priority} onValueChange={(v: "high" | "medium" | "low") => setAddForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Due Date</label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !addForm.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {addForm.due_date ? format(addForm.due_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={addForm.due_date || undefined}
                    onSelect={(date) => { setAddForm(f => ({ ...f, due_date: date || null })); setDueDateOpen(false); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Assign To</label>
              {selectedAssignee ? (
                <div className="flex items-center gap-2 border border-border rounded-md p-2 h-10">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={selectedAssignee.avatar || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {selectedAssignee.first_name?.charAt(0)}{selectedAssignee.last_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate flex-1">{selectedAssignee.full_name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignee(null);
                      setAddForm(f => ({ ...f, assigned_to: "" }));
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setShowMemberDropdown(true);
                    }}
                    onFocus={() => memberSearch.trim().length >= 1 && setShowMemberDropdown(true)}
                    placeholder="Type to search members..."
                    className="pl-9"
                    autoComplete="off"
                  />
                  {showMemberDropdown && memberSearch.trim().length >= 1 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {membersLoading ? (
                        <div className="p-3 text-center">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      ) : filteredMembers.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          {assignableMembers.length === 0 ? "No committee members yet" : "No matches found"}
                        </div>
                      ) : (
                        filteredMembers.map(member => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              setSelectedAssignee(member);
                              setAddForm(f => ({ ...f, assigned_to: member.id }));
                              setShowMemberDropdown(false);
                              setMemberSearch("");
                            }}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.avatar || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {member.first_name?.charAt(0)}{member.last_name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{member.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{member.role}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button className="w-full" onClick={handleAddItem} disabled={!addForm.title.trim() || addLoading}>
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Planning Template</DialogTitle>
            <DialogDescription>Choose a template to pre-populate your checklist with suggested tasks</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {templatesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No templates available for this event type</div>
            ) : (
              templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template.id)}
                  disabled={applying}
                  className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>{template.task_count} tasks</span>
                        {template.estimated_timeline_days && (
                          <span>{template.estimated_timeline_days} days planning</span>
                        )}
                        {template.estimated_budget_min && template.estimated_budget_max && (
                          <span>TZS {(template.estimated_budget_min / 1e6).toFixed(1)}M – {(template.estimated_budget_max / 1e6).toFixed(1)}M</span>
                        )}
                      </div>
                    </div>
                    {applying && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist Item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventChecklist;

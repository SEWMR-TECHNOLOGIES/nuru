import { useEffect, useState, useCallback, useRef } from "react";
import { Users, Search, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, KeyRound, Loader2, Edit, ShieldAlert, ShieldOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminUsers() {
  useAdminMeta("Users");
  const cache = adminCaches.users;
  const [users, setUsers] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Record<string, any> | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetDialog, setResetDialog] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [editDialog, setEditDialog] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  
  // Suspend dialog
  const [suspendDialog, setSuspendDialog] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  
  // Notify invalid name dialog
  const [notifyDialog, setNotifyDialog] = useState<{ id: string; name: string } | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifying, setNotifying] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getUsers({ page, limit: 20, q: q || undefined });
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      setUsers(data);
      setPagination((res as any).pagination ?? null);
    } else if (initialLoad.current) toast.error("Failed to load users");
    setLoading(false);
    initialLoad.current = false;
  }, [page, q]);

  useEffect(() => {
    if (!cache.loaded || q || page > 1) initialLoad.current = true;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);
  usePolling(load);

  const openUser = async (id: string) => {
    const res = await adminApi.getUserDetail(id);
    if (res.success) setSelected(res.data);
    else toast.error("Failed to load user");
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setActionLoading(id);
    const res = isActive ? await adminApi.deactivateUser(id) : await adminApi.activateUser(id);
    if (res.success) { toast.success(isActive ? "User deactivated" : "User activated"); load(); setSelected(null); }
    else toast.error(res.message || "Action failed");
    setActionLoading(null);
  };

  const handleResetPassword = async () => {
    if (!resetDialog || newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setResetting(true);
    const res = await adminApi.resetUserPassword(resetDialog.id, newPassword);
    if (res.success) { toast.success(`Password reset for ${resetDialog.name}`); setResetDialog(null); setNewPassword(""); }
    else toast.error(res.message || "Failed to reset password");
    setResetting(false);
  };

  const openEditDialog = (user: any) => {
    setEditForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', phone: user.phone || '', location: user.location || '' });
    setEditDialog(user);
  };

  const handleEditSave = async () => {
    if (!editDialog) return;
    setEditSaving(true);
    const res = await adminApi.updateUser(editDialog.id, editForm);
    if (res.success) { toast.success("User updated & notified"); setEditDialog(null); load(); }
    else toast.error(res.message || "Failed to update user");
    setEditSaving(false);
  };

  const handleSuspend = async () => {
    if (!suspendDialog || !suspendReason.trim()) { toast.error("Please provide a suspension reason"); return; }
    setSuspending(true);
    const res = await adminApi.suspendUser(suspendDialog.id, suspendReason.trim());
    if (res.success) { toast.success(`${suspendDialog.name} suspended`); setSuspendDialog(null); setSuspendReason(""); load(); setSelected(null); }
    else toast.error(res.message || "Failed to suspend");
    setSuspending(false);
  };

  const handleUnsuspend = async (id: string) => {
    setActionLoading(id);
    const res = await adminApi.unsuspendUser(id);
    if (res.success) { toast.success("Suspension lifted"); load(); setSelected(null); }
    else toast.error(res.message || "Failed to unsuspend");
    setActionLoading(null);
  };

  const handleNotifyInvalidName = async () => {
    if (!notifyDialog) return;
    setNotifying(true);
    const res = await adminApi.notifyInvalidName(notifyDialog.id, notifyMessage.trim() || undefined);
    if (res.success) { toast.success(`Notification sent to ${notifyDialog.name}`); setNotifyDialog(null); setNotifyMessage(""); }
    else toast.error(res.message || "Failed to send notification");
    setNotifying(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all registered Nuru users</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name, email, phone..." className="pl-9" />
      </div>

      {loading ? (
        <AdminTableSkeleton columns={6} rows={8} />
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No users found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Verified</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-muted-foreground">@{u.username || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div>{u.email}</div><div className="text-xs text-muted-foreground">{u.phone || "—"}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {u.is_email_verified && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Email</span>}
                      {u.is_phone_verified && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Phone</span>}
                      {u.is_identity_verified && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">ID</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-fit", u.is_active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                      {u.is_suspended && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 w-fit">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openUser(u.id)}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                      {u.is_suspended ? (
                        <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleUnsuspend(u.id)} disabled={actionLoading === u.id}>
                          <ShieldOff className="w-3.5 h-3.5 mr-1" /> Unsuspend
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          onClick={() => { setSuspendDialog({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setSuspendReason(""); }}>
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Suspend
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-muted-foreground"
                        onClick={() => { setNotifyDialog({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setNotifyMessage(""); }}
                        title="Warn about invalid name">
                        <Bell className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.total_pages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.total_pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>User Profile</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                  {selected.avatar ? <img src={selected.avatar} alt="" className="w-14 h-14 rounded-full object-cover" /> : `${selected.first_name?.[0] || ""}${selected.last_name?.[0] || ""}`}
                </div>
                <div>
                  <div className="font-semibold text-base">{selected.first_name} {selected.last_name}</div>
                  <div className="text-muted-foreground">@{selected.username}</div>
                  {selected.is_suspended && (
                    <div className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Suspended
                    </div>
                  )}
                </div>
              </div>
              {selected.is_suspended && selected.suspension_reason && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">Suspension Reason</p>
                  <p className="text-sm text-foreground">{selected.suspension_reason}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <span>{selected.email}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span>{selected.phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Events:</span> <span>{selected.event_count}</span></div>
                <div><span className="text-muted-foreground">Services:</span> <span>{selected.service_count}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span>{selected.location || "—"}</span></div>
                <div><span className="text-muted-foreground">Joined:</span> <span>{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : "—"}</span></div>
              </div>
              {selected.bio && <p className="text-muted-foreground text-xs bg-muted rounded-lg p-3">{selected.bio}</p>}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="flex-1" onClick={() => { setSelected(null); openEditDialog(selected); }}>
                  <Edit className="w-4 h-4 mr-1.5" /> Edit
                </Button>
                {selected.is_suspended ? (
                  <Button className="flex-1" onClick={() => handleUnsuspend(selected.id)} disabled={actionLoading === selected.id}>
                    <ShieldOff className="w-4 h-4 mr-1.5" /> Unsuspend
                  </Button>
                ) : (
                  <Button variant="destructive" className="flex-1" onClick={() => { setSelected(null); setSuspendDialog({ id: selected.id, name: `${selected.first_name} ${selected.last_name}` }); setSuspendReason(""); }}>
                    <ShieldAlert className="w-4 h-4 mr-1.5" /> Suspend
                  </Button>
                )}
                <Button variant="outline" onClick={() => { setSelected(null); setNotifyDialog({ id: selected.id, name: `${selected.first_name} ${selected.last_name}` }); setNotifyMessage(""); }}>
                  <Bell className="w-4 h-4 mr-1.5" /> Warn Name
                </Button>
                <Button variant="outline" onClick={() => { setSelected(null); setResetDialog({ id: selected.id, name: `${selected.first_name} ${selected.last_name}` }); setNewPassword(""); }}>
                  <KeyRound className="w-4 h-4 mr-1.5" /> Reset PW
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={() => { setResetDialog(null); setNewPassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">Set a new password for <strong>{resetDialog?.name}</strong>.</p>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setResetDialog(null); setNewPassword(""); }}>Cancel</Button>
            <Button className="flex-1" onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}>
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-4 h-4" /> Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5"><Label>First Name</Label><Input value={editForm.first_name || ''} onChange={e => setEditForm((p: any) => ({ ...p, first_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Last Name</Label><Input value={editForm.last_name || ''} onChange={e => setEditForm((p: any) => ({ ...p, last_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={editForm.email || ''} onChange={e => setEditForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={editForm.phone || ''} onChange={e => setEditForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={editForm.location || ''} onChange={e => setEditForm((p: any) => ({ ...p, location: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend User Dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={() => { setSuspendDialog(null); setSuspendReason(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> Suspend Account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">Suspend <strong>{suspendDialog?.name}</strong>'s account. They will see a suspension notice and can only browse in read-only mode.</p>
            <div className="space-y-1.5">
              <Label>Reason for suspension *</Label>
              <Textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g., Invalid/fake name provided, suspicious activity..." className="resize-none" rows={3} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setSuspendDialog(null); setSuspendReason(""); }}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleSuspend} disabled={suspending || !suspendReason.trim()}>
              {suspending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ShieldAlert className="w-4 h-4 mr-1.5" />}
              Suspend Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify Invalid Name Dialog */}
      <Dialog open={!!notifyDialog} onOpenChange={() => { setNotifyDialog(null); setNotifyMessage(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Warn About Invalid Name</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">Send a notification to <strong>{notifyDialog?.name}</strong> warning them to update their name to a real name or business name. Failure to comply may result in account suspension.</p>
            <div className="space-y-1.5">
              <Label>Custom message (optional)</Label>
              <Textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Leave empty to use default warning message..." className="resize-none" rows={3} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setNotifyDialog(null); setNotifyMessage(""); }}>Cancel</Button>
            <Button className="flex-1" onClick={handleNotifyInvalidName} disabled={notifying}>
              {notifying ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Bell className="w-4 h-4 mr-1.5" />}
              Send Warning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

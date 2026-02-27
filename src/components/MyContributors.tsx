import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Phone, Mail, StickyNote, Loader2, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserContributors } from '@/data/useUserContributors';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import ContributorListSkeleton from '@/components/ui/ContributorListSkeleton';
import type { UserContributor } from '@/lib/api/contributors';

const ITEMS_PER_PAGE = 10;

const MyContributors = () => {
  useWorkspaceMeta({ title: 'My Contributors', description: 'Manage your contributor address book' });
  const { contributors, loading, create, update, remove } = useUserContributors();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserContributor | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = contributors.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
  }).sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', email: '', phone: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: UserContributor) => {
    setEditTarget(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', notes: c.notes || '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      if (editTarget) {
        await update(editTarget.id, {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        } as any);
        toast.success('Contributor updated');
      } else {
        await create({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        toast.success('Contributor added');
      }
      setDialogOpen(false);
    } catch (err: any) { showCaughtError(err, 'Failed to save contributor'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (c: UserContributor) => {
    const ok = await confirm({
      title: 'Delete Contributor',
      description: `Are you sure you want to delete "${c.name}"? This will also remove them from all events.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove(c.id);
      toast.success('Contributor deleted');
    } catch (err: any) { showCaughtError(err, 'Failed to delete'); }
  };

  if (loading) return <ContributorListSkeleton />;

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">My Contributors</h1>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Your personal address book of contributors. Add them to any event quickly.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search contributors..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search ? 'No contributors found' : 'No contributors yet'}</p>
          <p className="text-sm mt-1">{search ? 'Try a different search term' : 'Add your first contributor to get started'}</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {paginated.map(c => (
                <div key={c.id} className="p-4 flex items-start justify-between gap-3 hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><StickyNote className="w-3 h-3" />{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                    return <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setCurrentPage(page)}>{page}</Button>;
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Contributor' : 'Add Contributor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712 345 678" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{editTarget ? 'Save Changes' : 'Add Contributor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyContributors;

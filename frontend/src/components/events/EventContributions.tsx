import { useState, useRef } from 'react';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { 
  DollarSign, Plus, Search, Filter, MoreVertical, Edit, Trash, Send, Download, TrendingUp, Users, Clock, Loader2, Eye, ChevronLeft, ChevronRight, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEventContributors } from '@/data/useContributors';
import { useEventContributions } from '@/data/useEvents';
import { useContributorSearch } from '@/hooks/useContributorSearch';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { showCaughtError } from '@/lib/api';
import { formatPrice } from '@/utils/formatPrice';
import { formatDateMedium } from '@/utils/formatDate';
import ContributionsSkeletonLoader from './ContributionsSkeletonLoader';
import ContributorDetailDialog from './ContributorDetailDialog';
import { generateContributionReport } from '@/utils/generatePdf';
import type { EventContributorSummary } from '@/lib/api/contributors';

interface EventContributionsProps {
  eventId: string;
  eventTitle?: string;
  eventBudget?: number;
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash' },
  { id: 'mobile', name: 'Mobile Money' },
  { id: 'bank_transfer', name: 'Bank Transfer' },
  { id: 'card', name: 'Card' },
  { id: 'cheque', name: 'Cheque' },
  { id: 'other', name: 'Other' }
];

const ITEMS_PER_PAGE = 10;

const EventContributions = ({ eventId, eventTitle, eventBudget }: EventContributionsProps) => {
  // New contributor-based hooks
  const { 
    eventContributors, summary: ecSummary, loading: ecLoading, error: ecError, 
    refetch: refetchEC, addToEvent, updateEventContributor, removeFromEvent, recordPayment, getPaymentHistory 
  } = useEventContributors(eventId);

  // Legacy contributions hook for thank-you & backward compat
  const { contributions, summary: legacySummary, loading: contribLoading, refetch: refetchContrib, sendThankYou } = useEventContributions(eventId);
  
  usePolling(() => { refetchEC(); refetchContrib(); }, 15000);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [addContributorDialogOpen, setAddContributorDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editPledgeDialogOpen, setEditPledgeDialogOpen] = useState(false);
  const [detailContributor, setDetailContributor] = useState<EventContributorSummary | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<EventContributorSummary | null>(null);
  const [editTarget, setEditTarget] = useState<EventContributorSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('contributors');
  const [currentPage, setCurrentPage] = useState(1);

  // Add contributor form
  const [addMode, setAddMode] = useState<'existing' | 'new'>('new');
  const [newContributor, setNewContributor] = useState({ name: '', email: '', phone: '', pledge_amount: '', notes: '' });
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [existingPledgeAmount, setExistingPledgeAmount] = useState('');
  
  // Search existing contributors
  const { results: searchResults, loading: searchLoading, search: searchContributors, clear: clearSearch } = useContributorSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Payment form
  const [payment, setPayment] = useState({ amount: '', payment_method: 'cash', payment_reference: '' });

  // Edit pledge
  const [editAmount, setEditAmount] = useState('');

  // Payment history dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Computed
  const summary = ecSummary || { total_pledged: 0, total_paid: 0, total_balance: 0, count: 0, currency: legacySummary?.currency || 'TZS' };
  const currency = summary.currency || 'TZS';

  // Filter event contributors
  const filteredContributors = eventContributors.filter(ec => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ec.contributor?.name?.toLowerCase().includes(q) ||
      ec.contributor?.email?.toLowerCase().includes(q) ||
      ec.contributor?.phone?.includes(q)
    );
  });
  const totalPages = Math.ceil(filteredContributors.length / ITEMS_PER_PAGE);
  const paginatedContributors = filteredContributors.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- Handlers ---

  const handleAddContributor = async () => {
    setIsSubmitting(true);
    try {
      if (addMode === 'existing' && selectedExistingId) {
        await addToEvent({
          contributor_id: selectedExistingId,
          pledge_amount: existingPledgeAmount ? parseFloat(existingPledgeAmount) : 0,
        });
      } else {
        if (!newContributor.name.trim()) { toast.error('Name is required'); setIsSubmitting(false); return; }
        if (!newContributor.phone.trim()) { toast.error('Phone number is required'); setIsSubmitting(false); return; }
        await addToEvent({
          name: newContributor.name,
          email: newContributor.email || undefined,
          phone: newContributor.phone,
          pledge_amount: newContributor.pledge_amount ? parseFloat(newContributor.pledge_amount) : 0,
          notes: newContributor.notes || undefined,
        });
      }
      toast.success('Contributor added to event');
      setAddContributorDialogOpen(false);
      resetAddForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to add contributor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentTarget) return;
    if (!payment.amount || parseFloat(payment.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      await recordPayment(paymentTarget.id, {
        amount: parseFloat(payment.amount),
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference || undefined,
      });
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentTarget(null);
      setPayment({ amount: '', payment_method: 'mpesa', payment_reference: '' });
    } catch (err: any) {
      showCaughtError(err, 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePledge = async () => {
    if (!editTarget) return;
    if (!editAmount || parseFloat(editAmount) < 0) { toast.error('Enter valid amount'); return; }
    setIsSubmitting(true);
    try {
      await updateEventContributor(editTarget.id, { pledge_amount: parseFloat(editAmount) });
      toast.success('Pledge updated');
      setEditPledgeDialogOpen(false);
      setEditTarget(null);
    } catch (err: any) {
      showCaughtError(err, 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (ecId: string) => {
    const confirmed = await confirm({
      title: 'Remove Contributor',
      description: 'Are you sure you want to remove this contributor from the event? This action cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await removeFromEvent(ecId);
      toast.success('Removed');
    } catch (err: any) {
      showCaughtError(err, 'Failed to remove');
    }
  };

  const handleViewHistory = async (ec: EventContributorSummary) => {
    setHistoryLoading(true);
    setHistoryDialogOpen(true);
    try {
      const data = await getPaymentHistory(ec.id);
      setHistoryData(data);
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDownloadReport = () => {
    generateContributionReport(
      eventTitle || 'Event',
      filteredContributors.map(ec => ({
        name: ec.contributor?.name || 'Unknown',
        pledged: ec.pledge_amount,
        paid: ec.total_paid,
        balance: ec.balance,
      })),
      { total_amount: summary.total_paid, target_amount: summary.total_pledged, currency, budget: eventBudget }
    );
  };

  const resetAddForm = () => {
    setNewContributor({ name: '', email: '', phone: '', pledge_amount: '', notes: '' });
    setSelectedExistingId(null);
    setExistingPledgeAmount('');
    setAddMode('new');
    clearSearch();
  };

  const loading = ecLoading || contribLoading;
  if (loading) return <ContributionsSkeletonLoader />;
  if (ecError) return <div className="p-6 text-center text-destructive">{ecError}</div>;

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Raised</p><p className="text-2xl font-bold text-green-600">{formatPrice(summary.total_paid)}</p></div><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Contributors</p><p className="text-2xl font-bold">{summary.count}</p></div><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Pledged</p><p className="text-2xl font-bold text-yellow-600">{formatPrice(summary.total_pledged)}</p></div><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-yellow-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-red-600">{formatPrice(summary.total_balance)}</p></div><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-red-600" /></div></div></CardContent></Card>
      </div>

      {summary.total_pledged > 0 && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Collection Progress</span><span className="text-sm text-muted-foreground">{formatPrice(summary.total_paid)} / {formatPrice(summary.total_pledged)}</span></div>
          <Progress value={summary.total_pledged > 0 ? (summary.total_paid / summary.total_pledged * 100) : 0} className="h-3" />
          <p className="text-sm text-muted-foreground mt-1">{summary.total_pledged > 0 ? (summary.total_paid / summary.total_pledged * 100).toFixed(1) : 0}% collected</p>
        </CardContent></Card>
      )}

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadReport}>
            <Download className="w-4 h-4 mr-2" />Report
          </Button>
          <Button onClick={() => { resetAddForm(); setAddContributorDialogOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-2" />Add Contributor
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contributors..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-9" />
        </div>
      </div>

      {/* Contributors Table */}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-sm font-medium">Contributor</th>
                <th className="text-right p-4 text-sm font-medium">Pledged</th>
                <th className="text-right p-4 text-sm font-medium">Paid</th>
                <th className="text-right p-4 text-sm font-medium">Balance</th>
                <th className="text-right p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedContributors.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No contributors added yet. Click "Add Contributor" to get started.</td></tr>
              ) : (
                paginatedContributors.map((ec) => (
                  <tr key={ec.id} className="hover:bg-muted/50">
                    <td className="p-4">
                      <p className="font-medium">{ec.contributor?.name || 'Unknown'}</p>
                      {ec.contributor?.email && <p className="text-xs text-muted-foreground">{ec.contributor.email}</p>}
                      {ec.contributor?.phone && <p className="text-xs text-muted-foreground">{ec.contributor.phone}</p>}
                    </td>
                    <td className="p-4 text-right text-yellow-600 font-medium">{formatPrice(ec.pledge_amount)}</td>
                    <td className="p-4 text-right text-green-600 font-medium">{formatPrice(ec.total_paid)}</td>
                    <td className="p-4 text-right font-semibold">
                      <span className={ec.balance > 0 ? 'text-destructive' : 'text-green-600'}>{formatPrice(ec.balance)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setPaymentTarget(ec); setPayment({ amount: '', payment_method: 'mpesa', payment_reference: '' }); setPaymentDialogOpen(true); }}>
                            <DollarSign className="w-4 h-4 mr-2" />Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditTarget(ec); setEditAmount(String(ec.pledge_amount)); setEditPledgeDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />Update Pledge
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewHistory(ec)}>
                            <Eye className="w-4 h-4 mr-2" />Payment History
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleRemove(ec.id)}>
                            <Trash className="w-4 h-4 mr-2" />Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredContributors.length)} of {filteredContributors.length}
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
      </CardContent></Card>

      {/* Add Contributor Dialog */}
      <Dialog open={addContributorDialogOpen} onOpenChange={(open) => { setAddContributorDialogOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Contributor to Event</DialogTitle></DialogHeader>
          <Tabs value={addMode} onValueChange={(v) => setAddMode(v as 'existing' | 'new')}>
            <TabsList className="w-full">
              <TabsTrigger value="new" className="flex-1">New Contributor</TabsTrigger>
              <TabsTrigger value="existing" className="flex-1">From Address Book</TabsTrigger>
            </TabsList>
            <TabsContent value="new">
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Name *</Label><Input value={newContributor.name} onChange={(e) => setNewContributor(p => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={newContributor.email} onChange={(e) => setNewContributor(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></div>
                  <div className="space-y-2"><Label>Phone *</Label><Input value={newContributor.phone} onChange={(e) => setNewContributor(p => ({ ...p, phone: e.target.value }))} placeholder="+255..." required /></div>
                </div>
                <div className="space-y-2"><Label>Pledge Amount ({currency})</Label><FormattedNumberInput value={newContributor.pledge_amount} onChange={(v) => setNewContributor(p => ({ ...p, pledge_amount: v }))} placeholder="e.g. 20,000" /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={newContributor.notes} onChange={(e) => setNewContributor(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
              </div>
            </TabsContent>
            <TabsContent value="existing">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Search Your Contributors</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search by name, email, or phone..."
                      className="pl-9"
                      onChange={(e) => searchContributors(e.target.value)}
                    />
                  </div>
                  {searchLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {searchResults.map(c => (
                        <div
                          key={c.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 ${selectedExistingId === c.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                          onClick={() => setSelectedExistingId(c.id)}
                        >
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedExistingId && (
                    <div className="space-y-2 pt-2">
                      <Label>Pledge Amount ({currency})</Label>
                      <FormattedNumberInput value={existingPledgeAmount} onChange={(v) => setExistingPledgeAmount(v)} placeholder="e.g. 20,000" />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddContributorDialogOpen(false); resetAddForm(); }}>Cancel</Button>
            <Button onClick={handleAddContributor} disabled={isSubmitting || (addMode === 'existing' && !selectedExistingId)}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : 'Add Contributor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) setPaymentTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Payment for {paymentTarget?.contributor?.name}</DialogTitle></DialogHeader>
          {paymentTarget && (
            <div className="text-sm text-muted-foreground mb-2">
              Pledge: {formatPrice(paymentTarget.pledge_amount)} · Paid so far: {formatPrice(paymentTarget.total_paid)} · Balance: {formatPrice(paymentTarget.balance)}
            </div>
          )}
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount ({currency}) *</Label>
                <FormattedNumberInput value={payment.amount} onChange={(v) => setPayment(p => ({ ...p, amount: v }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payment.payment_method} onValueChange={(v) => setPayment(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Payment Reference</Label><Input value={payment.payment_reference} onChange={(e) => setPayment(p => ({ ...p, payment_reference: e.target.value }))} placeholder="Transaction ID..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaymentDialogOpen(false); setPaymentTarget(null); }}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pledge Dialog */}
      <Dialog open={editPledgeDialogOpen} onOpenChange={setEditPledgeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Pledge for {editTarget?.contributor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pledge Amount ({currency})</Label>
              <FormattedNumberInput value={editAmount} onChange={(v) => setEditAmount(v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPledgeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePledge} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update Pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{historyData?.contributor?.name} — Payment History</DialogTitle></DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : historyData ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-yellow-50 text-center">
                  <p className="text-xs text-muted-foreground">Pledged</p>
                  <p className="font-bold text-yellow-700">{formatPrice(historyData.pledge_amount)}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-bold text-green-700">{formatPrice(historyData.total_paid)}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 text-center">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-bold text-red-700">{formatPrice(Math.max(0, historyData.pledge_amount - historyData.total_paid))}</p>
                </div>
              </div>
              <div className="divide-y border rounded-lg">
                {historyData.payments?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">No payments recorded yet</div>
                ) : (
                  historyData.payments?.map((p: any) => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <Badge className="bg-green-100 text-green-800">Payment</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateMedium(p.created_at)}</p>
                        {p.payment_reference && <p className="text-xs text-muted-foreground">Ref: {p.payment_reference}</p>}
                      </div>
                      <p className="font-bold text-green-600">{formatPrice(p.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">Failed to load history</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventContributions;

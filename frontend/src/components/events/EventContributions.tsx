import { useState, useMemo } from 'react';
import { 
  DollarSign, Plus, Search, Filter, MoreVertical, Edit, Trash, Send, Download, TrendingUp, Users, Clock, Loader2, Eye, ChevronLeft, ChevronRight
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEventContributions } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import { formatPrice } from '@/utils/formatPrice';
import { formatDateMedium } from '@/utils/formatDate';
import ContributionsSkeletonLoader from './ContributionsSkeletonLoader';
import ContributorDetailDialog from './ContributorDetailDialog';
import { generateContributionReport } from '@/utils/generatePdf';

interface EventContributionsProps {
  eventId: string;
  eventTitle?: string;
  eventBudget?: number;
}

const PAYMENT_METHODS = [
  { id: 'mpesa', name: 'M-Pesa', icon: '📱' },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦' },
  { id: 'cash', name: 'Cash', icon: '💵' },
  { id: 'card', name: 'Card', icon: '💳' },
  { id: 'cheque', name: 'Cheque', icon: '📄' },
  { id: 'other', name: 'Other', icon: '📋' }
];

const ITEMS_PER_PAGE = 10;

const EventContributions = ({ eventId, eventTitle, eventBudget }: EventContributionsProps) => {
  const { contributions, summary, loading, error, addContribution, updateContribution, deleteContribution, sendThankYou, refetch } = useEventContributions(eventId);
  usePolling(refetch, 15000);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pledgeDialogOpen, setPledgeDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editPledgeDialogOpen, setEditPledgeDialogOpen] = useState(false);
  const [contributionForContributor, setContributionForContributor] = useState<string | null>(null);
  const [detailContributor, setDetailContributor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('contributions');
  const [currentPage, setCurrentPage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);

  const [editingContribution, setEditingContribution] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');

  const [newContribution, setNewContribution] = useState({
    amount: '', payment_method: 'mpesa', payment_reference: '',
    message: '', is_anonymous: false, notes: ''
  });

  const [newPledge, setNewPledge] = useState({
    contributor_name: '', contributor_email: '', contributor_phone: '',
    amount: '', notes: ''
  });

  // Record a new pledge (set target for a NEW contributor)
  const handleAddPledge = async () => {
    if (!newPledge.contributor_name.trim()) { toast.error('Please enter name'); return; }
    if (!newPledge.amount || parseFloat(newPledge.amount) <= 0) { toast.error('Please enter a valid target amount'); return; }
    setIsSubmitting(true);
    try {
      await addContribution({
        contributor_name: newPledge.contributor_name,
        contributor_email: newPledge.contributor_email || undefined,
        contributor_phone: newPledge.contributor_phone || undefined,
        amount: parseFloat(newPledge.amount),
        currency: summary?.currency || 'TZS',
        payment_method: 'other' as any,
        notes: newPledge.notes || undefined,
        status: 'pending'
      });
      toast.success('Pledge target recorded');
      setPledgeDialogOpen(false);
      setNewPledge({ contributor_name: '', contributor_email: '', contributor_phone: '', amount: '', notes: '' });
    } catch (err: any) {
      showCaughtError(err, 'Failed to record pledge');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record contribution for an EXISTING contributor (who already has a pledge)
  const handleAddContribution = async () => {
    if (!contributionForContributor) return;
    if (!newContribution.amount || parseFloat(newContribution.amount) <= 0) { toast.error('Please enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      await addContribution({
        contributor_name: contributionForContributor,
        amount: parseFloat(newContribution.amount),
        currency: summary?.currency || 'TZS',
        payment_method: newContribution.payment_method as any,
        payment_reference: newContribution.payment_reference || undefined,
        message: newContribution.message || undefined,
        is_anonymous: newContribution.is_anonymous,
        notes: newContribution.notes || undefined,
        status: 'confirmed'
      });
      toast.success('Contribution recorded');
      setAddDialogOpen(false);
      setContributionForContributor(null);
      resetContributionForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to record contribution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePledge = async () => {
    if (!editingContribution) return;
    if (!editAmount || parseFloat(editAmount) <= 0) { toast.error('Enter valid amount'); return; }
    setIsSubmitting(true);
    try {
      await updateContribution(editingContribution.id, { amount: parseFloat(editAmount) });
      toast.success('Pledge updated');
      setEditPledgeDialogOpen(false);
      setEditingContribution(null);
    } catch (err: any) {
      showCaughtError(err, 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      await deleteContribution(id);
      toast.success('Deleted');
    } catch (err: any) {
      showCaughtError(err, 'Failed to delete');
    }
  };

  const handleSendThankYou = async (contributionId: string) => {
    try {
      await sendThankYou(contributionId, 'email');
      toast.success('Thank you message sent');
    } catch (err: any) {
      showCaughtError(err, 'Failed to send thank you');
    }
  };

  const resetContributionForm = () => {
    setNewContribution({
      amount: '', payment_method: 'mpesa', payment_reference: '',
      message: '', is_anonymous: false, notes: ''
    });
  };

  const filteredContributions = contributions.filter(c => {
    const matchesSearch = c.contributor_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Paginated contributions
  const totalPages = Math.ceil(filteredContributions.length / ITEMS_PER_PAGE);
  const paginatedContributions = filteredContributions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Build contributor summary
  const contributorMap = new Map<string, { name: string; pledged: number; paid: number; email?: string; phone?: string }>();
  contributions.forEach(c => {
    const key = c.contributor_name.toLowerCase();
    const existing = contributorMap.get(key) || { name: c.contributor_name, pledged: 0, paid: 0 };
    if (c.status === 'pending') existing.pledged += c.amount;
    if (c.status === 'confirmed') existing.paid += c.amount;
    if (c.contributor_email) existing.email = c.contributor_email;
    if (c.contributor_phone) existing.phone = c.contributor_phone;
    contributorMap.set(key, existing);
  });
  const contributorSummaries = Array.from(contributorMap.values());

  // Search & paginate summaries
  const filteredSummaries = contributorSummaries.filter(cs =>
    cs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cs.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cs.phone?.includes(searchQuery)
  );
  const summaryTotalPages = Math.ceil(filteredSummaries.length / ITEMS_PER_PAGE);
  const paginatedSummaries = filteredSummaries.slice((summaryPage - 1) * ITEMS_PER_PAGE, summaryPage * ITEMS_PER_PAGE);

  const handleDownloadReport = () => {
    generateContributionReport(
      eventTitle || 'Event',
      contributorSummaries.map(cs => ({ name: cs.name, pledged: cs.pledged, paid: cs.paid, balance: Math.max(0, cs.pledged - cs.paid) })),
      { total_amount: summary?.total_amount || 0, target_amount: summary?.target_amount, currency: summary?.currency, budget: eventBudget }
    );
  };

  const getContributorHistory = (name: string) => contributions.filter(c => c.contributor_name.toLowerCase() === name.toLowerCase());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pledged</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) return <ContributionsSkeletonLoader />;
  if (error) return <div className="p-6 text-center text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Raised</p><p className="text-2xl font-bold text-green-600">{formatPrice(summary.total_amount)}</p></div><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Contributors</p><p className="text-2xl font-bold">{contributorSummaries.length}</p></div><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Confirmed</p><p className="text-2xl font-bold text-green-600">{summary.confirmed_count || contributions.filter(c=>c.status==='confirmed').length}</p></div><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pledges</p><p className="text-2xl font-bold text-yellow-600">{summary.pending_count || contributions.filter(c=>c.status==='pending').length}</p></div><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div></div></CardContent></Card>
          </div>
          {summary.target_amount ? (
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Progress to Target</span><span className="text-sm text-muted-foreground">{formatPrice(summary.total_amount)} / {formatPrice(summary.target_amount)}</span></div>
              <Progress value={summary.progress_percentage} className="h-3" />
              <p className="text-sm text-muted-foreground mt-1">{summary.progress_percentage?.toFixed(1)}% of target reached</p>
            </CardContent></Card>
          ) : null}
        </>
      )}

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadReport}>
            <Download className="w-4 h-4 mr-2" />Report
          </Button>
          <Button onClick={() => setPledgeDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Record Pledge
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeSubTab} onValueChange={(v) => { setActiveSubTab(v); setCurrentPage(1); setSummaryPage(1); }}>
        <TabsList><TabsTrigger value="contributions">All Records</TabsTrigger><TabsTrigger value="summary">Contributor Summary</TabsTrigger></TabsList>
        
        {/* Search bar below tabs */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); setSummaryPage(1); }} className="pl-9" />
          </div>
          {activeSubTab === 'contributions' && (
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-40"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pledged</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="contributions">
          <Card><CardContent className="p-0">
            <div className="divide-y">
              {paginatedContributions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No contributions or pledges recorded yet</div>
              ) : (
                paginatedContributions.map((contribution) => (
                  <div key={contribution.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contribution.is_anonymous ? 'Anonymous' : contribution.contributor_name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{PAYMENT_METHODS.find(m => m.id === contribution.payment_method)?.name || contribution.payment_method}</span>
                          {contribution.payment_reference && <span>· Ref: {contribution.payment_reference}</span>}
                        </div>
                        {contribution.message && <p className="text-sm text-muted-foreground mt-1 italic">"{contribution.message}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-lg text-green-600">{formatPrice(contribution.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateMedium(contribution.created_at)}</p>
                      </div>
                      {getStatusBadge(contribution.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!contribution.thank_you_sent && contribution.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => handleSendThankYou(contribution.id)}><Send className="w-4 h-4 mr-2" />Send Thank You</DropdownMenuItem>
                          )}
                          {contribution.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => { setEditingContribution(contribution); setEditAmount(String(contribution.amount)); setEditPledgeDialogOpen(true); }}>
                                <Edit className="w-4 h-4 mr-2" />Update Target
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setContributionForContributor(contribution.contributor_name); resetContributionForm(); setAddDialogOpen(true); }}>
                                <DollarSign className="w-4 h-4 mr-2" />Record Payment
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => setDetailContributor(contribution.contributor_name)}>
                            <Eye className="w-4 h-4 mr-2" />View History
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(contribution.id)}>
                            <Trash className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredContributions.length)} of {filteredContributions.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                    return (
                      <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setCurrentPage(page)}>
                        {page}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
        
        <TabsContent value="summary">
          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">Contributor</th>
                    <th className="text-right p-4 text-sm font-medium">Pledged (Target)</th>
                    <th className="text-right p-4 text-sm font-medium">Paid</th>
                    <th className="text-right p-4 text-sm font-medium">Balance</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedSummaries.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No data yet</td></tr>
                  ) : (
                    paginatedSummaries.map((cs, i) => {
                      const balance = Math.max(0, cs.pledged - cs.paid);
                      return (
                        <tr key={i} className="hover:bg-muted/50 cursor-pointer" onClick={() => setDetailContributor(cs.name)}>
                          <td className="p-4">
                            <p className="font-medium">{cs.name}</p>
                            {cs.email && <p className="text-xs text-muted-foreground">{cs.email}</p>}
                            {cs.phone && <p className="text-xs text-muted-foreground">{cs.phone}</p>}
                          </td>
                          <td className="p-4 text-right text-yellow-600 font-medium">{formatPrice(cs.pledged)}</td>
                          <td className="p-4 text-right text-green-600 font-medium">{formatPrice(cs.paid)}</td>
                          <td className="p-4 text-right font-semibold">
                            <span className={balance > 0 ? 'text-destructive' : 'text-green-600'}>{formatPrice(balance)}</span>
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Record Payment" onClick={() => { setContributionForContributor(cs.name); resetContributionForm(); setAddDialogOpen(true); }}>
                                <DollarSign className="w-3 h-3 mr-1" />Pay
                              </Button>
                              <Button size="sm" variant="ghost" title="View History" onClick={() => setDetailContributor(cs.name)}>
                                <Eye className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Summary Pagination */}
            {summaryTotalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((summaryPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(summaryPage * ITEMS_PER_PAGE, filteredSummaries.length)} of {filteredSummaries.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={summaryPage === 1} onClick={() => setSummaryPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(summaryTotalPages, 5) }, (_, i) => {
                    const page = summaryTotalPages <= 5 ? i + 1 : Math.max(1, Math.min(summaryPage - 2, summaryTotalPages - 4)) + i;
                    return (
                      <Button key={page} variant={page === summaryPage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSummaryPage(page)}>
                        {page}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={summaryPage === summaryTotalPages} onClick={() => setSummaryPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Record Contribution Dialog (for existing contributors only) */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setContributionForContributor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Payment for {contributionForContributor}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount ({summary?.currency || 'TZS'}) *</Label>
                <Input type="number" min="0" value={newContribution.amount} onChange={(e) => setNewContribution(prev => ({ ...prev, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={newContribution.payment_method} onValueChange={(v) => setNewContribution(prev => ({ ...prev, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Payment Reference</Label><Input value={newContribution.payment_reference} onChange={(e) => setNewContribution(prev => ({ ...prev, payment_reference: e.target.value }))} placeholder="Transaction ID..." /></div>
            <div className="space-y-2"><Label>Message</Label><Textarea value={newContribution.message} onChange={(e) => setNewContribution(prev => ({ ...prev, message: e.target.value }))} placeholder="Optional message..." rows={2} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="anonymous" checked={newContribution.is_anonymous} onCheckedChange={(checked) => setNewContribution(prev => ({ ...prev, is_anonymous: !!checked }))} />
              <Label htmlFor="anonymous" className="cursor-pointer">Record as anonymous</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetContributionForm(); setContributionForContributor(null); }}>Cancel</Button>
            <Button onClick={handleAddContribution} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Pledge Dialog (NEW contributor) */}
      <Dialog open={pledgeDialogOpen} onOpenChange={setPledgeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Pledge (Set Target)</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Register a new contributor and set their target amount. You can record payments for them later.</p>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Contributor Name *</Label><Input value={newPledge.contributor_name} onChange={(e) => setNewPledge(prev => ({ ...prev, contributor_name: e.target.value }))} placeholder="Full name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={newPledge.contributor_email} onChange={(e) => setNewPledge(prev => ({ ...prev, contributor_email: e.target.value }))} placeholder="email@example.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={newPledge.contributor_phone} onChange={(e) => setNewPledge(prev => ({ ...prev, contributor_phone: e.target.value }))} placeholder="+255..." /></div>
            </div>
            <div className="space-y-2"><Label>Target Amount ({summary?.currency || 'TZS'}) *</Label><Input type="number" min="0" value={newPledge.amount} onChange={(e) => setNewPledge(prev => ({ ...prev, amount: e.target.value }))} placeholder="e.g. 20000" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={newPledge.notes} onChange={(e) => setNewPledge(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes..." rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPledgeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPledge} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : 'Record Pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pledge Target Dialog */}
      <Dialog open={editPledgeDialogOpen} onOpenChange={setEditPledgeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Target for {editingContribution?.contributor_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Target Amount ({summary?.currency || 'TZS'})</Label>
              <Input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPledgeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePledge} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update Target'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contributor Detail Dialog */}
      {detailContributor && (
        <ContributorDetailDialog
          open={!!detailContributor}
          onOpenChange={(open) => !open && setDetailContributor(null)}
          contributorName={detailContributor}
          contributions={getContributorHistory(detailContributor)}
        />
      )}
    </div>
  );
};

export default EventContributions;

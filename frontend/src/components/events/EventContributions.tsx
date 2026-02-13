import { useState, useRef } from 'react';
import readXlsxFile from 'read-excel-file';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { 
  DollarSign, Plus, Search, Filter, MoreVertical, Edit, Trash, Send, Download, TrendingUp, Users, Clock, Loader2, Eye, ChevronLeft, ChevronRight, UserPlus, Upload, FileSpreadsheet, AlertCircle, CheckCircle2
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { generateContributionReportHtml } from '@/utils/generatePdf';
import ReportPreviewDialog from '@/components/ReportPreviewDialog';
import { contributorsApi } from '@/lib/api/contributors';
import type { EventContributorSummary } from '@/lib/api/contributors';

interface EventContributionsProps {
  eventId: string;
  eventTitle?: string;
  eventBudget?: number;
}

// EventContributions needs eventBudget for display

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
  const [thankYouDialogOpen, setThankYouDialogOpen] = useState(false);
  const [thankYouTarget, setThankYouTarget] = useState<EventContributorSummary | null>(null);
  const [thankYouMessage, setThankYouMessage] = useState('');
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

  // Report preview
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState('');

  // Bulk upload
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'targets' | 'contributions'>('targets');
  const [bulkSendSms, setBulkSendSms] = useState(false);
  const [bulkRows, setBulkRows] = useState<{ name: string; phone: string; amount: number }[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ processed: number; errors_count: number; errors: { row: number; message: string }[] } | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

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
  }).sort((a, b) => (a.contributor?.name || '').localeCompare(b.contributor?.name || ''));
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
      setPayment({ amount: '', payment_method: 'cash', payment_reference: '' });
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
    const sortedContributors = [...filteredContributors].sort((a, b) => 
      (a.contributor?.name || '').localeCompare(b.contributor?.name || '')
    );
    const html = generateContributionReportHtml(
      eventTitle || 'Event',
      sortedContributors.map(ec => ({
        name: ec.contributor?.name || 'Unknown',
        pledged: ec.pledge_amount,
        paid: ec.total_paid,
        balance: ec.balance,
      })),
      { total_amount: summary.total_paid, target_amount: summary.total_pledged, currency, budget: eventBudget }
    );
    setReportHtml(html);
    setReportPreviewOpen(true);
  };

  const resetAddForm = () => {
    setNewContributor({ name: '', email: '', phone: '', pledge_amount: '', notes: '' });
    setSelectedExistingId(null);
    setExistingPledgeAmount('');
    setAddMode('new');
    clearSearch();
  };

  const resetBulkForm = () => {
    setBulkRows([]);
    setBulkFileName('');
    setBulkErrors([]);
    setBulkResult(null);
    setBulkSendSms(false);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  const formatTanzanianPhone = (raw: string): string => {
    let phone = raw.toString().replace(/[\s\-\+]/g, '');
    if (phone.startsWith('0') && phone.length === 10) phone = phone.slice(1);
    if (/^[67]/.test(phone)) phone = '255' + phone;
    if (/^255[67]\d{8}$/.test(phone)) return phone;
    throw new Error(`Invalid phone: ${raw}`);
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkErrors([]);
    setBulkRows([]);
    setBulkResult(null);

    try {
      const rows = await readXlsxFile(file);
      // Expect header row: s/n, name, phone, amount
      if (rows.length < 2) { setBulkErrors(['File must have a header row and at least one data row']); return; }
      
      const header = rows[0].map(h => String(h || '').toLowerCase().trim());
      if (header.length < 3) { setBulkErrors(['File must have at least 3 columns: S/N, Name, Phone']); return; }

      const parsed: { name: string; phone: string; amount: number }[] = [];
      const parseErrors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[1] || '').trim();
        const phoneRaw = String(row[2] || '').trim();
        const amountRaw = row[3];

        if (!name && !phoneRaw) continue; // skip empty rows

        if (!name) { parseErrors.push(`Row ${i + 1}: Name is missing`); continue; }
        if (!phoneRaw) { parseErrors.push(`Row ${i + 1}: Phone is missing for ${name}`); continue; }

        let phone: string;
        try {
          phone = formatTanzanianPhone(phoneRaw);
        } catch {
          parseErrors.push(`Row ${i + 1}: Invalid phone "${phoneRaw}" for ${name}`);
          continue;
        }

        const amount = amountRaw ? parseFloat(String(amountRaw).replace(/,/g, '')) : 0;
        if (isNaN(amount) || amount < 0) { parseErrors.push(`Row ${i + 1}: Invalid amount for ${name}`); continue; }

        parsed.push({ name, phone, amount });
      }

      setBulkRows(parsed);
      if (parseErrors.length > 0) setBulkErrors(parseErrors);
    } catch {
      setBulkErrors(['Failed to parse file. Please ensure it is a valid .xlsx file.']);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkRows.length === 0) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await contributorsApi.bulkAddToEvent(eventId, {
        contributors: bulkRows,
        send_sms: bulkSendSms,
        mode: bulkMode,
      });
      if (res.success) {
        setBulkResult(res.data);
        toast.success(`${res.data.processed} contributors processed`);
        setBulkRows([]);
        setBulkFileName('');
        setBulkErrors([]);
        if (bulkFileRef.current) bulkFileRef.current.value = '';
        refetchEC();
      } else {
        toast.error(res.message || 'Bulk upload failed');
      }
    } catch (err: any) {
      showCaughtError(err, 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadSampleXlsx = async () => {
    const writeXlsxFile = (await import('write-excel-file')).default;

    const sampleData = [
      { sn: 1, name: 'Amina Juma', phone: '255654321098', amount: 50000 },
      { sn: 2, name: 'Baraka Mushi', phone: '255712345678', amount: 100000 },
      { sn: 3, name: 'Catherine Lyimo', phone: '255687654321', amount: 75000 },
      { sn: 4, name: 'David Mwakasege', phone: '255763219876', amount: 200000 },
      { sn: 5, name: 'Esther Kimaro', phone: '255655432109', amount: 30000 },
      { sn: 6, name: 'Fadhili Hassan', phone: '255714567890', amount: 150000 },
      { sn: 7, name: 'Grace Shirima', phone: '255689012345', amount: 0 },
      { sn: 8, name: 'Hussein Bakari', phone: '255768901234', amount: 80000 },
      { sn: 9, name: 'Irene Massawe', phone: '255651234567', amount: 60000 },
      { sn: 10, name: 'Joseph Mlay', phone: '255719876543', amount: 120000 },
      { sn: 11, name: 'Khadija Omary', phone: '255682345678', amount: 45000 },
      { sn: 12, name: 'Linus Mwanga', phone: '255767890123', amount: 90000 },
      { sn: 13, name: 'Mariam Salum', phone: '255658765432', amount: 25000 },
      { sn: 14, name: 'Noel Urassa', phone: '255710987654', amount: 110000 },
      { sn: 15, name: 'Penina Mbwilo', phone: '255685678901', amount: 70000 },
    ];

    const HEADER_ROW = [
      { value: 'S/N', fontWeight: 'bold' as const },
      { value: 'Contributor Name', fontWeight: 'bold' as const },
      { value: 'Phone', fontWeight: 'bold' as const },
      { value: 'Target Amount', fontWeight: 'bold' as const },
    ];

    const dataRows = sampleData.map(d => [
      { type: Number as any, value: d.sn },
      { type: String as any, value: d.name },
      { type: String as any, value: d.phone },
      { type: Number as any, value: d.amount },
    ]);

    const data = [HEADER_ROW, ...dataRows];

    await writeXlsxFile(data as any, {
      fileName: 'contributors_template.xlsx',
      columns: [
        { width: 6 },
        { width: 25 },
        { width: 18 },
        { width: 18 },
      ],
    });
  };

  const loading = ecLoading || contribLoading;
  if (loading) return <ContributionsSkeletonLoader />;
  if (ecError) return <div className="p-6 text-center text-destructive">{ecError}</div>;

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {eventBudget ? (
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Event Budget</p><p className="text-lg font-bold">{formatPrice(eventBudget)}</p></div><div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-blue-600" /></div></div></CardContent></Card>
        ) : null}
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Raised</p><p className="text-lg font-bold text-green-600">{formatPrice(summary.total_paid)}</p></div><div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Pledged</p><p className="text-lg font-bold text-yellow-600">{formatPrice(summary.total_pledged)}</p></div><div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-yellow-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Pledge Shortfall</p><p className="text-lg font-bold text-orange-600">{formatPrice(Math.max(0, summary.total_pledged - summary.total_paid))}</p></div><div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-orange-600" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold text-red-600">{formatPrice(summary.total_balance)}</p></div><div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-red-600" /></div></div></CardContent></Card>
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
          <Button variant="outline" size="sm" onClick={() => { resetBulkForm(); setBulkDialogOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" />Bulk Upload
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
                          <DropdownMenuItem onClick={() => { setPaymentTarget(ec); setPayment({ amount: '', payment_method: 'cash', payment_reference: '' }); setPaymentDialogOpen(true); }}>
                            <DollarSign className="w-4 h-4 mr-2" />Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditTarget(ec); setEditAmount(String(ec.pledge_amount)); setEditPledgeDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />Update Pledge
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewHistory(ec)}>
                            <Eye className="w-4 h-4 mr-2" />Payment History
                          </DropdownMenuItem>
                          {ec.total_paid > 0 && (
                            <DropdownMenuItem onClick={() => { setThankYouTarget(ec); setThankYouMessage(''); setThankYouDialogOpen(true); }}>
                              <Send className="w-4 h-4 mr-2" />Send Thank You
                            </DropdownMenuItem>
                          )}
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

      {/* Send Thank You Dialog */}
      <Dialog open={thankYouDialogOpen} onOpenChange={(open) => { setThankYouDialogOpen(open); if (!open) setThankYouTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Thank You to {thankYouTarget?.contributor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              A thank you SMS will be sent to {thankYouTarget?.contributor?.phone || 'the contributor'}.
            </p>
            <div className="space-y-2">
              <Label>Custom Message (optional)</Label>
              <Textarea
                value={thankYouMessage}
                onChange={(e) => setThankYouMessage(e.target.value)}
                placeholder="Add a personal thank you message..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThankYouDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={async () => {
                if (!thankYouTarget) return;
                setIsSubmitting(true);
                try {
                  const { contributorsApi } = await import('@/lib/api/contributors');
                  const res = await contributorsApi.sendThankYou(eventId, thankYouTarget.id, { custom_message: thankYouMessage || undefined });
                  if (res.success) {
                    toast.success('Thank you sent!');
                    setThankYouDialogOpen(false);
                    setThankYouTarget(null);
                  } else {
                    toast.error(res.message || 'Failed to send');
                  }
                } catch (err: any) {
                  showCaughtError(err, 'Failed to send thank you');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Thank You</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { setBulkDialogOpen(open); if (!open) resetBulkForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Upload Contributors</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>Upload Mode</Label>
              <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as 'targets' | 'contributions')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="targets">Set Pledge Targets</SelectItem>
                  <SelectItem value="contributions">Record Contributions</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {bulkMode === 'targets' 
                  ? 'Set or update pledge targets for multiple contributors at once.' 
                  : 'Record actual payments/contributions for multiple contributors at once.'}
              </p>
            </div>

            {/* Sample Download */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/30">
              <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Download Sample Template</p>
                <p className="text-xs text-muted-foreground">Columns: S/N, Name, Phone (255 format), Amount</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSampleXlsx}>
                <Download className="w-4 h-4 mr-1" />Template
              </Button>
            </div>

            {/* File Input */}
            <div className="space-y-2">
              <Label>Upload File (.xlsx, .xls, .csv)</Label>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleBulkFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {/* Parse Results */}
            {bulkFileName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">{bulkFileName}</span>
                  <Badge variant="secondary">{bulkRows.length} valid rows</Badge>
                </div>
                {bulkRows.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50 border-b">
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Phone</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {bulkRows.slice(0, 20).map((r, i) => (
                          <tr key={i}><td className="p-2">{i + 1}</td><td className="p-2">{r.name}</td><td className="p-2">{r.phone}</td><td className="p-2 text-right">{formatPrice(r.amount)}</td></tr>
                        ))}
                        {bulkRows.length > 20 && <tr><td colSpan={4} className="p-2 text-center text-muted-foreground">...and {bulkRows.length - 20} more</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Parse Errors */}
            {bulkErrors.length > 0 && (
              <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-1 max-h-32 overflow-y-auto">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium"><AlertCircle className="w-4 h-4" />Parsing Issues</div>
                {bulkErrors.map((err, i) => <p key={i} className="text-xs text-destructive/80">• {err}</p>)}
              </div>
            )}

            {/* SMS Checkbox */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
              <Checkbox
                id="bulk-sms"
                checked={bulkSendSms}
                onCheckedChange={(v) => setBulkSendSms(v === true)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="bulk-sms" className="text-sm font-medium cursor-pointer">Send SMS notifications</label>
                <p className="text-xs text-muted-foreground">
                  {bulkSendSms 
                    ? '⚠️ SMS will be sent to each contributor. This may take longer for large uploads.' 
                    : 'No SMS will be sent. You can notify contributors later individually.'}
                </p>
              </div>
            </div>

            {/* Upload Result */}
            {bulkResult && (
              <div className="border rounded-lg p-3 bg-green-50 space-y-1">
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium"><CheckCircle2 className="w-4 h-4" />Upload Complete</div>
                <p className="text-xs text-green-600">{bulkResult.processed} contributors processed, {bulkResult.errors_count} errors</p>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {bulkResult.errors.map((e, i) => <p key={i} className="text-xs text-destructive">Row {e.row}: {e.message}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDialogOpen(false); resetBulkForm(); }}>
              {bulkResult ? 'Close' : 'Cancel'}
            </Button>
            {!bulkResult && (
              <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkRows.length === 0}>
                {bulkUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload {bulkRows.length} Contributors</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Preview */}
      <ReportPreviewDialog
        open={reportPreviewOpen}
        onOpenChange={setReportPreviewOpen}
        title="Contribution Report"
        html={reportHtml}
      />
    </div>
  );
};

export default EventContributions;

import { useState } from 'react';
import { format } from 'date-fns';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import {
  Receipt, Plus, Search, MoreVertical, Edit, Trash, Download, Loader2, Eye, ChevronLeft, ChevronRight, CalendarIcon
} from 'lucide-react';
import bellIcon from '@/assets/icons/bell-icon.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePolling } from '@/hooks/usePolling';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { showCaughtError } from '@/lib/api';
import { formatPrice } from '@/utils/formatPrice';
import { formatDateMedium } from '@/utils/formatDate';
import { eventsApi } from '@/lib/api/events';
import { generateExpenseReportHtml } from '@/utils/generatePdf';
import ReportPreviewDialog from '@/components/ReportPreviewDialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventPermissions } from '@/hooks/useEventPermissions';

interface EventExpensesProps {
  eventId: string;
  eventTitle?: string;
  eventBudget?: number;
  totalRaised?: number;
  permissions?: EventPermissions;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Venue', 'Catering', 'Decorations', 'Entertainment', 'Photography',
  'Transport', 'Printing', 'Gifts & Favors', 'Equipment Rental',
  'Marketing', 'Staffing', 'Fundraising', 'Miscellaneous'
];

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash' },
  { id: 'mobile', name: 'Mobile Money' },
  { id: 'bank_transfer', name: 'Bank Transfer' },
  { id: 'card', name: 'Card' },
  { id: 'cheque', name: 'Cheque' },
  { id: 'other', name: 'Other' }
];

const ITEMS_PER_PAGE = 10;

const EventExpenses = ({ eventId, eventTitle, eventBudget, totalRaised = 0, permissions }: EventExpensesProps) => {
  const canManage = permissions?.can_manage_expenses || permissions?.is_creator;
  const canView = permissions?.can_view_expenses || permissions?.can_manage_expenses || permissions?.is_creator;

  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [customCategory, setCustomCategory] = useState('');
  const [customCategoryMode, setCustomCategoryMode] = useState(false);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    category: '',
    description: '',
    amount: '',
    payment_method: 'cash',
    payment_reference: '',
    vendor_name: '',
    expense_date: new Date(),
    notes: '',
    notify_committee: false,
  });

  // Report
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [reportDateDialogOpen, setReportDateDialogOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(undefined);
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(undefined);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await eventsApi.getExpenses(eventId, { limit: 100 });
      if (res.success) {
        setExpenses(res.data.expenses || []);
        setSummary(res.data.summary || null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // Initial fetch
  useState(() => { fetchExpenses(); });
  usePolling(fetchExpenses, 15000);

  const resetForm = () => {
    setForm({
      category: '', description: '', amount: '', payment_method: 'cash',
      payment_reference: '', vendor_name: '', expense_date: new Date(),
      notes: '', notify_committee: false,
    });
    setCustomCategory('');
    setCustomCategoryMode(false);
  };

  const handleAdd = async () => {
    if (!form.category) { toast.error('Select a category'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      const res = await eventsApi.addExpense(eventId, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method || undefined,
        payment_reference: form.payment_reference || undefined,
        vendor_name: form.vendor_name || undefined,
        expense_date: format(form.expense_date, 'yyyy-MM-dd'),
        notes: form.notes || undefined,
        notify_committee: form.notify_committee,
      });
      if (res.success) {
        toast.success('Expense recorded');
        setAddDialogOpen(false);
        resetForm();
        fetchExpenses();
      } else {
        toast.error(res.message || 'Failed');
      }
    } catch (err: any) { showCaughtError(err, 'Failed to record expense'); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!editingExpense) return;
    if (!form.category) { toast.error('Select a category'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      const res = await eventsApi.updateExpense(eventId, editingExpense.id, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method || undefined,
        payment_reference: form.payment_reference || undefined,
        vendor_name: form.vendor_name || undefined,
        expense_date: format(form.expense_date, 'yyyy-MM-dd'),
        notes: form.notes || undefined,
      });
      if (res.success) {
        toast.success('Expense updated');
        setEditDialogOpen(false);
        setEditingExpense(null);
        resetForm();
        fetchExpenses();
      } else {
        toast.error(res.message || 'Failed');
      }
    } catch (err: any) { showCaughtError(err, 'Failed to update expense'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (expenseId: string) => {
    const confirmed = await confirm({
      title: 'Delete Expense',
      description: 'Are you sure you want to delete this expense record? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await eventsApi.deleteExpense(eventId, expenseId);
      if (res.success) {
        toast.success('Expense deleted');
        fetchExpenses();
      } else {
        toast.error(res.message || 'Failed');
      }
    } catch (err: any) { showCaughtError(err, 'Failed to delete'); }
  };

  const openEditDialog = (expense: any) => {
    // Blur active element to prevent aria-hidden focus conflict
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setEditingExpense(expense);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      payment_method: expense.payment_method || 'cash',
      payment_reference: expense.payment_reference || '',
      vendor_name: expense.vendor_name || '',
      expense_date: expense.expense_date ? new Date(expense.expense_date) : new Date(),
      notes: expense.notes || '',
      notify_committee: false,
    });
    setEditDialogOpen(true);
  };

  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const params: { date_from?: string; date_to?: string } = {};
      if (reportDateFrom) params.date_from = format(reportDateFrom, 'yyyy-MM-dd');
      if (reportDateTo) params.date_to = format(reportDateTo, 'yyyy-MM-dd');

      const res = await eventsApi.getExpenseReport(eventId, params);
      if (!res.success) { toast.error(res.message || 'Failed to fetch report'); return; }

      const dateRangeLabel = (reportDateFrom || reportDateTo)
        ? `${reportDateFrom ? format(reportDateFrom, 'dd MMM yyyy') : 'Start'} — ${reportDateTo ? format(reportDateTo, 'dd MMM yyyy') : 'Present'}`
        : undefined;

      const html = generateExpenseReportHtml(
        eventTitle || 'Event',
        res.data.expenses,
        {
          ...res.data.summary,
          budget: eventBudget,
          total_raised: totalRaised,
        },
        dateRangeLabel
      );
      setReportHtml(html);
      setReportDateDialogOpen(false);
      setReportPreviewOpen(true);
    } catch (err: any) { showCaughtError(err, 'Failed to generate report'); }
    finally { setReportLoading(false); }
  };

  // Filter
  const filtered = expenses.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.description?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.vendor_name?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalExpenses = summary?.total_expenses || 0;
  const remaining = totalRaised - totalExpenses;
  const currency = summary?.currency || 'TZS';

  if (!canView) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">You don't have permission to view expenses.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const renderExpenseFormFields = (onSubmit: () => void, submitLabel: string) => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          {customCategoryMode ? (
            <div className="flex gap-2">
              <Input
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="Enter custom category"
                className="flex-1"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && customCategory.trim()) {
                    setForm(f => ({ ...f, category: customCategory.trim() }));
                    setCustomCategoryMode(false);
                    setCustomCategory('');
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => {
                if (customCategory.trim()) {
                  setForm(f => ({ ...f, category: customCategory.trim() }));
                }
                setCustomCategoryMode(false);
                setCustomCategory('');
              }}>Set</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setCustomCategoryMode(false);
                setCustomCategory('');
              }}>✕</Button>
            </div>
          ) : (
            <Select value={form.category} onValueChange={v => {
              if (v === '__custom__') {
                setCustomCategoryMode(true);
                setCustomCategory('');
              } else {
                setForm(f => ({ ...f, category: v }));
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {(() => {
                  const allCats = new Set(DEFAULT_EXPENSE_CATEGORIES);
                  expenses.forEach(e => { if (e.category) allCats.add(e.category); });
                  // If current category is a custom one not in defaults, add it
                  if (form.category && !allCats.has(form.category)) allCats.add(form.category);
                  return Array.from(allCats).sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>);
                })()}
                <SelectItem value="__custom__">+ Add custom category</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Amount ({currency}) *</Label>
          <FormattedNumberInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Vendor / Supplier</Label>
          <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="Vendor name" />
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method</Label>
          <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Payment Reference</Label>
          <Input value={form.payment_reference} onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))} placeholder="Receipt / ref no." />
        </div>
        <div className="space-y-1.5">
          <Label>Expense Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.expense_date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.expense_date ? format(form.expense_date, 'dd MMM yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.expense_date} onSelect={d => d && setForm(f => ({ ...f, expense_date: d }))} /></PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." rows={2} />
      </div>

      {!editingExpense && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox id="notify" checked={form.notify_committee} onCheckedChange={v => setForm(f => ({ ...f, notify_committee: !!v }))} />
          <div>
            <label htmlFor="notify" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
              <img src={bellIcon} alt="" className="w-3.5 h-3.5 dark:invert" /> Notify committee members
            </label>
            <p className="text-xs text-muted-foreground">Send notification to members with expense management permission</p>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <div className="space-y-4">
      <ConfirmDialog />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-base font-semibold text-destructive mt-1">{formatPrice(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary?.count || 0} expense{(summary?.count || 0) !== 1 ? 's' : ''} recorded</p>
              </div>
              <div className="w-9 h-9 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Money Raised</p>
                <p className="text-base font-semibold text-primary mt-1">{formatPrice(totalRaised)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total contributions</p>
              </div>
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={remaining < 0 ? 'border-destructive/30' : 'border-primary/20'}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Remaining Balance</p>
                <p className={cn("text-base font-semibold mt-1", remaining < 0 ? "text-destructive" : "text-primary")}>{formatPrice(remaining)}</p>
                <p className="text-xs text-muted-foreground mt-1">Raised − Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {summary?.category_breakdown && summary.category_breakdown.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Expense Breakdown by Category</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {summary.category_breakdown.map((cat: any) => (
                <div key={cat.category} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div>
                    <p className="text-xs font-medium">{cat.category}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.count} item{cat.count !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-xs font-semibold">{formatPrice(cat.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={reportDateDialogOpen} onOpenChange={setReportDateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" /> Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader><DialogTitle>Expense Report</DialogTitle><DialogDescription>Generate a filtered expense report.</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Optionally filter by date range, or leave blank for all expenses.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !reportDateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {reportDateFrom ? format(reportDateFrom, 'dd MMM yyyy') : 'Start'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={reportDateFrom} onSelect={setReportDateFrom} /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label>To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !reportDateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {reportDateTo ? format(reportDateTo, 'dd MMM yyyy') : 'End'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={reportDateTo} onSelect={setReportDateTo} /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                {(reportDateFrom || reportDateTo) && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setReportDateFrom(undefined); setReportDateTo(undefined); }}>
                    Clear dates
                  </Button>
                )}
                <DialogFooter>
                  <Button onClick={handleDownloadReport} disabled={reportLoading}>
                    {reportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    Generate Report
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          {canManage && (
            <Dialog open={addDialogOpen} onOpenChange={v => { setAddDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" /> Record Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={e => e.preventDefault()}>
                <DialogHeader><DialogTitle>Record Expense</DialogTitle><DialogDescription>Fill in the details to record a new expense.</DialogDescription></DialogHeader>
                {renderExpenseFormFields(handleAdd, 'Record Expense')}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No expenses recorded yet</p>
          {canManage && <p className="text-xs mt-1">Click "Record Expense" to track event spending</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map(expense => (
            <Card key={expense.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{expense.description}</p>
                      <Badge variant="secondary" className="text-[10px]">{expense.category}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      {expense.vendor_name && <span>{expense.vendor_name}</span>}
                      <span>{expense.expense_date ? formatDateMedium(expense.expense_date) : '—'}</span>
                      {expense.payment_method && <span className="capitalize">{expense.payment_method.replace('_', ' ')}</span>}
                      {expense.recorded_by_name && <span>by {expense.recorded_by_name}</span>}
                    </div>
                    {expense.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{expense.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-destructive whitespace-nowrap">{formatPrice(expense.amount)}</p>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(expense)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(expense.id)}>
                            <Trash className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs px-2">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog - programmatic open from dropdown */}
      <Dialog open={editDialogOpen} onOpenChange={v => { setEditDialogOpen(v); if (!v) setEditingExpense(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle><DialogDescription>Update the expense details below.</DialogDescription></DialogHeader>
          {renderExpenseFormFields(handleEdit, 'Save Changes')}
        </DialogContent>
      </Dialog>

      {/* Report Preview */}
      <ReportPreviewDialog
        open={reportPreviewOpen}
        onOpenChange={setReportPreviewOpen}
        title="Expense Report"
        html={reportHtml}
      />
    </div>
  );
};

export default EventExpenses;

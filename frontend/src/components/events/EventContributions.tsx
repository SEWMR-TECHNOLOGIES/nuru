import { useState } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash,
  Send,
  Download,
  TrendingUp,
  Users,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useEventContributions } from '@/data/useEvents';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import { formatPrice } from '@/utils/formatPrice';

interface EventContributionsProps {
  eventId: string;
}

const PAYMENT_METHODS = [
  { id: 'mpesa', name: 'M-Pesa', icon: '📱' },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦' },
  { id: 'cash', name: 'Cash', icon: '💵' },
  { id: 'card', name: 'Card', icon: '💳' },
  { id: 'cheque', name: 'Cheque', icon: '📄' },
  { id: 'other', name: 'Other', icon: '📋' }
];

const EventContributions = ({ eventId }: EventContributionsProps) => {
  const { contributions, summary, loading, error, addContribution, sendThankYou, refetch } = useEventContributions(eventId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newContribution, setNewContribution] = useState({
    contributor_name: '',
    contributor_email: '',
    contributor_phone: '',
    amount: '',
    payment_method: 'mpesa',
    payment_reference: '',
    message: '',
    is_anonymous: false,
    notes: ''
  });

  const handleAddContribution = async () => {
    if (!newContribution.contributor_name.trim()) {
      toast.error('Please enter the contributor name');
      return;
    }
    if (!newContribution.amount || parseFloat(newContribution.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await addContribution({
        contributor_name: newContribution.contributor_name,
        contributor_email: newContribution.contributor_email || undefined,
        contributor_phone: newContribution.contributor_phone || undefined,
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
      resetForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to record contribution');
    } finally {
      setIsSubmitting(false);
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

  const resetForm = () => {
    setNewContribution({
      contributor_name: '',
      contributor_email: '',
      contributor_phone: '',
      amount: '',
      payment_method: 'mpesa',
      payment_reference: '',
      message: '',
      is_anonymous: false,
      notes: ''
    });
  };

  const filteredContributions = contributions.filter(c => {
    const matchesSearch = c.contributor_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading contributions...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Raised</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(summary.total_amount)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Contributors</p>
                    <p className="text-2xl font-bold">{summary.total_contributions}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Confirmed</p>
                    <p className="text-2xl font-bold text-green-600">{summary.confirmed_count}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{summary.pending_count}</p>
                  </div>
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress to Target */}
          {summary.target_amount && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress to Target</span>
                  <span className="text-sm text-muted-foreground">
                    {formatPrice(summary.total_amount)} / {formatPrice(summary.target_amount)}
                  </span>
                </div>
                <Progress value={summary.progress_percentage} className="h-3" />
                <p className="text-sm text-muted-foreground mt-1">
                  {summary.progress_percentage.toFixed(1)}% of target reached
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Contribution
          </Button>
        </div>
      </div>

      {/* Contributions List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredContributions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No contributions recorded yet
              </div>
            ) : (
              filteredContributions.map((contribution) => (
                <div key={contribution.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {contribution.is_anonymous ? 'Anonymous' : contribution.contributor_name}
                        </p>
                        {contribution.is_anonymous && (
                          <Badge variant="outline" className="text-xs">Anonymous</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{PAYMENT_METHODS.find(m => m.id === contribution.payment_method)?.name || contribution.payment_method}</span>
                        {contribution.payment_reference && (
                          <span>• Ref: {contribution.payment_reference}</span>
                        )}
                      </div>
                      {contribution.message && (
                        <p className="text-sm text-muted-foreground mt-1 italic">"{contribution.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">
                        {formatPrice(contribution.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(contribution.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(contribution.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!contribution.thank_you_sent && contribution.status === 'confirmed' && (
                          <DropdownMenuItem onClick={() => handleSendThankYou(contribution.id)}>
                            <Send className="w-4 h-4 mr-2" />Send Thank You
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Contribution Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Contribution</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contributor-name">Contributor Name *</Label>
              <Input
                id="contributor-name"
                value={newContribution.contributor_name}
                onChange={(e) => setNewContribution(prev => ({ ...prev, contributor_name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contributor-email">Email</Label>
                <Input
                  id="contributor-email"
                  type="email"
                  value={newContribution.contributor_email}
                  onChange={(e) => setNewContribution(prev => ({ ...prev, contributor_email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contributor-phone">Phone</Label>
                <Input
                  id="contributor-phone"
                  value={newContribution.contributor_phone}
                  onChange={(e) => setNewContribution(prev => ({ ...prev, contributor_phone: e.target.value }))}
                  placeholder="+255..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({summary?.currency || 'TZS'}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  value={newContribution.amount}
                  onChange={(e) => setNewContribution(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select 
                  value={newContribution.payment_method} 
                  onValueChange={(v) => setNewContribution(prev => ({ ...prev, payment_method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(method => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.icon} {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference</Label>
              <Input
                id="reference"
                value={newContribution.payment_reference}
                onChange={(e) => setNewContribution(prev => ({ ...prev, payment_reference: e.target.value }))}
                placeholder="Transaction ID, receipt number, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message from Contributor</Label>
              <Textarea
                id="message"
                value={newContribution.message}
                onChange={(e) => setNewContribution(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Optional message..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={newContribution.is_anonymous}
                onCheckedChange={(checked) => setNewContribution(prev => ({ ...prev, is_anonymous: !!checked }))}
              />
              <Label htmlFor="anonymous" className="cursor-pointer">Record as anonymous contribution</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddContribution} disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Contribution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventContributions;

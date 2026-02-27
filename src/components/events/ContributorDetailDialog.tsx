/**
 * ContributorDetailDialog - shows a contributor's full history (pledges + payments)
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/utils/formatPrice';
import { formatDateMedium } from '@/utils/formatDate';
import type { EventContribution } from '@/lib/api/types';

interface ContributorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributorName: string;
  contributions: EventContribution[];
}

const ContributorDetailDialog = ({ open, onOpenChange, contributorName, contributions }: ContributorDetailDialogProps) => {
  const pledged = contributions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const paid = contributions.filter(c => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0);
  const balance = Math.max(0, pledged - paid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contributorName} — Contribution History</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-yellow-50 text-center">
              <p className="text-xs text-muted-foreground">Pledged</p>
              <p className="font-bold text-yellow-700">{formatPrice(pledged)}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-center">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="font-bold text-green-700">{formatPrice(paid)}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 text-center">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-red-700">{formatPrice(balance)}</p>
            </div>
          </div>

          {/* Transaction list */}
          <div className="divide-y border rounded-lg">
            {contributions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No records</div>
            ) : (
              contributions.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'confirmed' ? 'default' : 'outline'} className={c.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {c.status === 'pending' ? 'Pledge' : 'Payment'}
                      </Badge>
                      {c.payment_method && <span className="text-xs text-muted-foreground capitalize">{c.payment_method.replace('_', ' ')}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateMedium(c.created_at)}</p>
                    {c.payment_reference && <p className="text-xs text-muted-foreground">Ref: {c.payment_reference}</p>}
                    {c.message && <p className="text-xs italic mt-1">"{c.message}"</p>}
                  </div>
                  <p className={`font-bold ${c.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {formatPrice(c.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContributorDetailDialog;

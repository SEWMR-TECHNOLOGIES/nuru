import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface PledgeDialogProps {
  eventId: string;
  onPledgeAdded: (pledge: any) => void;
}

const PledgeDialog = ({ eventId, onPledgeAdded }: PledgeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    type: 'money',
    description: '',
    contact: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const pledge = {
      id: Date.now().toString(),
      ...formData,
      status: 'pledged',
      date: new Date().toLocaleDateString(),
      eventId
    };

    onPledgeAdded(pledge);
    setFormData({ name: '', amount: '', type: 'money', description: '', contact: '' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Record Pledge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record New Pledge</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Contributor Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="type">Contribution Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="money">Money</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="item">Item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">
              {formData.type === 'money' ? 'Amount (TZS)' : 'Description'}
            </Label>
            <Input
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder={formData.type === 'money' ? '50000' : 'Photography services'}
              required
            />
          </div>

          <div>
            <Label htmlFor="contact">Contact (Optional)</Label>
            <Input
              id="contact"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="Phone or email"
            />
          </div>

          <div>
            <Label htmlFor="description">Notes (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Record Pledge
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PledgeDialog;
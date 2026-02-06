import { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Clock,
  MapPin,
  MoreVertical,
  Edit,
  Trash,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEventSchedule } from '@/data/useEvents';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import type { EventScheduleItem } from '@/lib/api/types';

interface EventScheduleProps {
  eventId: string;
}

const EventSchedule = ({ eventId }: EventScheduleProps) => {
  const { schedule, loading, error, addItem, updateItem, deleteItem, refetch } = useEventSchedule(eventId);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventScheduleItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: ''
  });

  const handleAddItem = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter the activity title');
      return;
    }
    if (!formData.start_time) {
      toast.error('Please enter the start time');
      return;
    }

    setIsSubmitting(true);
    try {
      await addItem({
        title: formData.title,
        description: formData.description || undefined,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        location: formData.location || undefined,
        display_order: schedule.length
      });
      toast.success('Schedule item added');
      setAddDialogOpen(false);
      resetForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    if (!formData.title.trim()) {
      toast.error('Please enter the activity title');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateItem(selectedItem.id, {
        title: formData.title,
        description: formData.description || undefined,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        location: formData.location || undefined
      });
      toast.success('Schedule item updated');
      setEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this schedule item?')) return;
    
    try {
      await deleteItem(itemId);
      toast.success('Schedule item deleted');
    } catch (err: any) {
      showCaughtError(err, 'Failed to delete item');
    }
  };

  const openEditDialog = (item: EventScheduleItem) => {
    setSelectedItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      start_time: item.start_time,
      end_time: item.end_time || '',
      location: item.location || ''
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      location: ''
    });
  };

  const formatTime = (time: string) => {
    try {
      return new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return time;
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading schedule...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Event Schedule</h2>
          <p className="text-muted-foreground">Plan your event timeline</p>
        </div>
        <Button onClick={() => { resetForm(); setAddDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Schedule Timeline */}
      <Card>
        <CardContent className="p-6">
          {schedule.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No schedule items yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add activities to create your event timeline
              </p>
              <Button onClick={() => { resetForm(); setAddDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Activity
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {schedule
                .sort((a, b) => a.display_order - b.display_order || a.start_time.localeCompare(b.start_time))
                .map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    {/* Time Column */}
                    <div className="w-24 flex-shrink-0 text-right">
                      <p className="font-semibold text-primary">{formatTime(item.start_time)}</p>
                      {item.end_time && (
                        <p className="text-sm text-muted-foreground">{formatTime(item.end_time)}</p>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      {index < schedule.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border min-h-[40px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                          {item.location && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                              <MapPin className="w-3 h-3" />
                              <span>{item.location}</span>
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Edit className="w-4 h-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteItem(item.id)}>
                              <Trash className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setAddDialogOpen(false);
          setEditDialogOpen(false);
          setSelectedItem(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activity-title">Activity Title *</Label>
              <Input
                id="activity-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Welcome Reception"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time *</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Main Hall, Garden Area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details about this activity..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false);
              setEditDialogOpen(false);
              setSelectedItem(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={selectedItem ? handleUpdateItem : handleAddItem} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (selectedItem ? 'Update' : 'Add Activity')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventSchedule;

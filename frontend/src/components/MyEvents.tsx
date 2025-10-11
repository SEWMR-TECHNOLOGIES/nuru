import { Calendar, Users, Edit2, Trash2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

const MyEvents = () => {
  useWorkspaceMeta({
    title: 'My Events',
    description: 'Manage all your events including weddings, birthdays, memorials, and celebrations.'
  });

  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  const statusOptions = ['Upcoming', 'Completed', 'Draft'];
  const statusStyles: Record<string, string> = {
    Upcoming: "bg-primary/10 text-primary",
    Completed: "bg-green-100 text-green-800",
    Draft: "bg-gray-100 text-gray-800"
  };

  useEffect(() => {
    const storedEvents = JSON.parse(localStorage.getItem('events') || '[]');

    // Keep status if already set, otherwise default to 'Upcoming'
    const eventsWithStatus = storedEvents.map((event: any) => ({
      ...event,
      status: event.status || 'Upcoming'
    }));

    setEvents(eventsWithStatus);
  }, []);

  const handleDelete = (id: string) => {
    const filtered = events.filter(event => event.id !== id);
    localStorage.setItem('events', JSON.stringify(filtered));
    setEvents(filtered);
  };

  // Helper to format budget to TZS
  const formatBudget = (budget: string) => {
    if (!budget) return '';
    let amount = budget.replace(/[^0-9]/g, ''); // remove any non-digit
    if (!amount) return '';
    return `TZS ${parseInt(amount).toLocaleString()}`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Events</h1>
        <Button 
          size="sm" 
          className="rounded-lg px-3 py-1"
          onClick={() => navigate('/create-event')}
        >
          + New Event
        </Button>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <article
            key={event.id}
            onClick={() => navigate(`/event-management/${event.id}`)}
            className="bg-card rounded-lg border border-border overflow-hidden transition-colors hover:bg-muted/10 cursor-pointer"
            role="article"
            aria-labelledby={`event-title-${event.id}`}
          >
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Image */}
                <div className="w-full sm:w-32 h-32 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/10">
                  {event.images && event.images.length > 0 && (
                    <img
                      src={event.images[0]}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          id={`event-title-${event.id}`}
                          className="font-semibold text-lg text-foreground"
                        >
                          {event.title}
                        </h3>
                        
                        {/* Status badge - mobile top right */}
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyles[event.status]} sm:hidden shrink-0`}
                        >
                          {event.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {(event.eventType || event.type) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {event.eventType || event.type}
                          </span>
                        )}
                        {event.eventCategory && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                            {event.eventCategory}
                          </span>
                        )}
                      </div>
                      {event.date && (
                        <p className="text-sm text-muted-foreground mt-1.5">
                          {new Date(event.date).toLocaleDateString()}
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {event.description || event.text}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>{event.expectedGuests || event.attendees || 0} guests</span>
                        </span>

                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{event.date ? new Date(event.date).toLocaleDateString() : ''}</span>
                        </span>
                      </div>

                      {/* Budget */}
                      {event.budget && (
                        <p className="text-sm font-medium text-foreground mt-2">
                          {formatBudget(event.budget)}
                        </p>
                      )}
                    </div>

                    {/* Status badge - desktop */}
                    <span
                      className={`hidden sm:inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyles[event.status]} shrink-0`}
                    >
                      {event.status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/create-event?edit=${event.id}`); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground hover:bg-muted transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Empty state hint */}
      {events.length === 0 && (
        <div className="mt-8 text-sm text-muted-foreground">
          Tip: Click <span className="font-medium">+ New Event</span> to add an event.
        </div>
      )}
    </div>
  );
};

export default MyEvents;

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, X, ChevronLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { useEventTypes } from "@/data/useEventTypes";
import { eventsApi } from "@/lib/api";
import EventIcon from "@/components/icons/EventIcons";
import { toast } from "sonner";
import { showApiErrors, showCaughtError } from "@/lib/api";
import EventRecommendations from "@/components/events/EventRecommendations";

const CreateEvent: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: undefined as Date | undefined,
    time: "",
    location: "",
    expectedGuests: "",
    budget: "",
    eventType: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleToggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };
  const { eventTypes, loading: loadingEventTypes, fetchEventTypes } = useEventTypes();

  useEffect(() => {
    fetchEventTypes();
  }, []);

  const displayedEventTypes = eventTypes && eventTypes.length > 0 ? eventTypes : [];

  // Load existing event data when editing
  useEffect(() => {
    if (editId) {
      const loadEvent = async () => {
        try {
          const response = await eventsApi.getById(editId);
          if (response.success && response.data) {
            const event = response.data;
            setFormData({
              title: event.title || "",
              description: event.description || "",
              date: event.start_date ? new Date(event.start_date) : undefined,
              time: (event as any).start_time || "",
              location: event.location || "",
              expectedGuests: event.expected_guests ? String(event.expected_guests) : "",
              budget: event.budget ? String(event.budget) : "",
              eventType: event.event_type_id || "wedding",
            });
            if (event.gallery_images && event.gallery_images.length > 0) {
              setPreviews(event.gallery_images);
            } else if ((event as any).images && (event as any).images.length > 0) {
              // Backend returns images as array of objects {image_url, ...}
              const imageUrls = (event as any).images.map((img: any) =>
                typeof img === 'string' ? img : (img.image_url || img.url)
              ).filter(Boolean);
              if (imageUrls.length > 0) setPreviews(imageUrls);
            }
          } else {
            showApiErrors(response, "Failed to load event");
          }
        } catch (err: any) {
          showCaughtError(err, "Failed to load event");
        }
      };
      loadEvent();
    }
  }, [editId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...filesArray]);
      setPreviews(prev => [...prev, ...filesArray.map(file => URL.createObjectURL(file))]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const form = new FormData();
      if (formData.eventType) form.append("event_type_id", formData.eventType);
      form.append("title", formData.title.trim());
      if (formData.description?.trim()) form.append("description", formData.description.trim());
      if (formData.date) form.append("start_date", format(formData.date, "yyyy-MM-dd"));
      if (formData.time) form.append("time", formData.time);
      if (formData.location) form.append("location", formData.location);
      
      const expectedGuests = formData.expectedGuests ? parseInt(String(formData.expectedGuests), 10) : null;
      if (expectedGuests !== null && !Number.isNaN(expectedGuests)) form.append("expected_guests", String(expectedGuests));

      const budgetNumber = formData.budget ? parseFloat(String(formData.budget).replace(/[^0-9.]/g, "")) : null;
      if (budgetNumber !== null && !Number.isNaN(budgetNumber)) form.append("budget", String(budgetNumber));

      if (images.length > 0) {
        images.forEach((file) => form.append("images", file));
      }

      const response = editId
        ? await eventsApi.update(editId, form)
        : await eventsApi.create(form);

      if (showApiErrors(response, "Failed to save event")) {
        return;
      }

      const createdId = (response.data as any)?.id || editId;

      // Assign selected services to the event
      if (selectedServices.length > 0 && createdId) {
        for (const svcId of selectedServices) {
          try {
            await eventsApi.addEventService(createdId, { provider_service_id: svcId });
          } catch {
            // Silent fail for individual service assignments
          }
        }
      }

      toast.success(response.message || (editId ? "Event updated successfully." : "Event created successfully."));
      navigate(`/event-management/${createdId}`);
    } catch (err: any) {
      console.error("Event API error:", err);
      showCaughtError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useWorkspaceMeta({
    title: "Create Event",
    description: "Plan your perfect event with comprehensive tools for weddings, birthdays, memorials, and more.",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {editId ? 'Edit Event' : 'Create New Event'}
          </h1>
          <p className="text-muted-foreground">
            {editId ? 'Update your event details' : 'Plan your perfect event with our comprehensive toolkit'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/my-events')}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Event Type <span className="text-destructive">*</span>
              </label>
              {loadingEventTypes ? (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="p-4 rounded-xl border border-border animate-pulse">
                      <div className="w-8 h-8 bg-muted rounded-lg mx-auto mb-2" />
                      <div className="h-3 bg-muted rounded w-16 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : displayedEventTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">No event types available</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {displayedEventTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, eventType: type.id })}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all duration-200 group",
                        formData.eventType === type.id
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "text-2xl mb-1.5 transition-transform duration-200",
                        formData.eventType === type.id ? "scale-110" : "group-hover:scale-105"
                      )}>
                        <EventIcon iconName={type.icon} />
                      </div>
                      <div className="text-xs font-medium leading-tight">{type.name}</div>
                    </button>
                  ))}
                </div>
              )}
              {!formData.eventType && !loadingEventTypes && displayedEventTypes.length > 0 && (
                <p className="text-xs text-destructive mt-1">Please select an event type</p>
              )}
            </div>

            {/* Title and Location */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Title</label>
                <Input
                  placeholder="e.g., Sarah & John's Wedding"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <Input
                  placeholder="Event venue or address"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                placeholder="Describe your event..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            {/* Date, Time, Guests */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => setFormData({ ...formData, date })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Expected Guests</label>
                <FormattedNumberInput
                  placeholder="50"
                  value={formData.expectedGuests}
                  onChange={(v) => setFormData({ ...formData, expectedGuests: v })}
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium mb-2">Estimated Budget (TZS)</label>
              <FormattedNumberInput
                placeholder="e.g., 5,000,000"
                value={formData.budget}
                onChange={(v) => setFormData({ ...formData, budget: v })}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Images (optional)</label>
              <div className="space-y-4">
                {previews.length > 0 && (
                  previews.length === 1 ? (
                    <div className="relative w-full h-64 rounded-lg overflow-hidden border border-border">
                      <img src={previews[0]} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(0)}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {previews.map((src, index) => (
                        <div key={index} className="relative group">
                          <img src={src} alt={`preview ${index}`} className="w-full h-32 object-cover rounded-lg" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                )}

                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG, or WEBP (max. 0.5MB per file)</p>
                  <label htmlFor="event-image-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => document.getElementById('event-image-upload')?.click()}
                    >
                      Choose Files
                    </Button>
                  </label>
                  <input
                    id="event-image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Recommendations */}
        <EventRecommendations
          eventTypeId={formData.eventType}
          eventTypeName={displayedEventTypes.find(t => t.id === formData.eventType)?.name}
          location={formData.location}
          budget={formData.budget}
          selectedServiceIds={selectedServices}
          onToggleService={handleToggleService}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!formData.title || !formData.date || !formData.eventType || isSubmitting}
          >
            {isSubmitting ? (editId ? "Updating event..." : "Creating event...") : (editId ? "Update Event" : "Create Event")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEvent;

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, CheckCircle2, Plus, Image, X, ChevronLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { useEventTypes } from "@/data/useEventTypes";
import EventIcon from "@/components/icons/EventIcons";
import { toast } from "sonner";
import { formatNumber } from "@/utils/formatNumber";

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
    eventType: "wedding",
  });

  // services as any per your request
  const [recommendedServices, setRecommendedServices] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Image upload state
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const { eventTypes, loading: loadingEventTypes, error, fetchEventTypes } = useEventTypes();

  useEffect(() => {
    fetchEventTypes();
  }, []);

  const displayedEventTypes = eventTypes && eventTypes.length > 0 ? eventTypes : [];

  // Load existing event data when editing (keeps original local behavior)
  useEffect(() => {
    if (editId) {
      const existingEvents = JSON.parse(localStorage.getItem("events") || "[]");
      const eventToEdit = existingEvents.find((e: any) => e.id === editId);

      if (eventToEdit) {
        setFormData({
          title: eventToEdit.title || "",
          description: eventToEdit.description || "",
          date: eventToEdit.date ? new Date(eventToEdit.date) : undefined,
          time: eventToEdit.time || "",
          location: eventToEdit.location || "",
          expectedGuests: eventToEdit.expectedGuests || "",
          budget: eventToEdit.budget?.replace("TZS ", "").replace(/,/g, "") || "",
          eventType: eventToEdit.eventType || "wedding",
        });

        // Load images if they exist (stored as data URLs)
        if (eventToEdit.images && eventToEdit.images.length > 0) {
          setPreviews(eventToEdit.images);
        }

        // Load services if they exist
        if (eventToEdit.services && eventToEdit.services.length > 0) {
          setRecommendedServices(eventToEdit.services);
          setShowRecommendations(true);
        }
      }
    }
  }, [editId]);

  // Convert file to Base64 (used for localStorage fallback)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // File input handler - stores File objects and object-URL previews
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

  const handleGenerateRecommendations = async () => {
    if (!formData.eventType) return;
    setIsFetchingRecommendations(true);

    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/events/recommendations/${formData.eventType}`, {
        method: "GET",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(txt || "Failed to fetch recommendations");
      }

      const data = await resp.json();

      const services = data.map((item: any, index: number) => ({
        id: item.id ?? `service_${index}`,
        service_type_id: item.service_type_id ?? `service_type_${index}`,
        name: item.service_type_name ?? `Service ${index + 1}`,
        category: item.category_name ?? "General",
        description: item.description ?? "",
        minPrice: item.min_price ?? null,
        maxPrice: item.max_price ?? null,
        priority: (item.priority as "high" | "medium" | "low") ?? "medium",
        completed: false,
        availableProviders: item.available_providers ?? 0
      }));

      setRecommendedServices(services);
      setShowRecommendations(true);
      toast.success("Recommendations loaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "An error occurred while fetching recommendations.");
    } finally {
      setIsFetchingRecommendations(false);
    }
  };

  const handleClearRecommendations = () => {
    setRecommendedServices([]);
    setShowRecommendations(false);
    toast.success("Recommendations cleared.");
  };

  const toggleServiceComplete = (serviceId: string) => {
    setRecommendedServices(prev => prev.map(service =>
      service.id === serviceId ? { ...service, completed: !service.completed } : service
    ));
  };

  const formatBudget = (budget: string) => {
    if (!budget) return "";
    const number = parseInt(budget.replace(/\D/g, "")) || 0;
    return `TZS ${number.toLocaleString("en-US")}`;
  };

// NEW: submit to API (multipart/form-data). Only save locally & navigate when API succeeds.
// If the API returns an error, show the API message(s) and DO NOT save locally or navigate.
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    // Prepare data for API
    const eventTypeId = formData.eventType;
    const title = formData.title.trim();
    const description = formData.description?.trim() || "";
    const dateStr = formData.date ? format(formData.date, "yyyy-MM-dd") : null;
    const time = formData.time || "";
    const location = formData.location || "";
    const expectedGuests = formData.expectedGuests ? parseInt(String(formData.expectedGuests), 10) : null;
    const budgetNumber = formData.budget ? parseFloat(String(formData.budget).replace(/[^0-9.]/g, "")) : null;

    // Services: only send selected (completed) services as { service_id }
    const selectedServices = recommendedServices
      .filter((s) => s.completed)
      .map((s) => ({ service_id: s.service_type_id ?? s.service_id ?? s.id }));

    // Build FormData for multipart
    const form = new FormData();
    if (eventTypeId) form.append("event_type_id", eventTypeId);
    form.append("title", title);
    if (description) form.append("description", description);
    if (dateStr) form.append("date", dateStr);
    if (time) form.append("time", time);
    if (location) form.append("location", location);
    if (expectedGuests !== null) form.append("expected_guests", String(expectedGuests));
    if (budgetNumber !== null && !Number.isNaN(budgetNumber)) form.append("budget", String(budgetNumber));
    form.append("services", JSON.stringify(selectedServices));

    // Append images files (key: images) - multiple
    if (images.length > 0) {
      images.forEach((file) => form.append("images", file));
    }

    // Make request
    const token = localStorage.getItem("token");
    const apiUrlBase = `${import.meta.env.VITE_API_BASE_URL}/events/new`;
    const url = editId ? `${apiUrlBase}/${editId}` : apiUrlBase;
    const method = editId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      body: form,
      headers: {
        // don't set content-type for multipart
        Authorization: token ? `Bearer ${token}` : "",
      },
      credentials: "include",
    });

    // Try to parse JSON response (if any)
    let result: any = null;
    let rawText: string | null = null;
    try {
      result = await response.json();
    } catch (parseErr) {
      // fallback to raw text for error message if JSON parsing fails
      rawText = await response.text().catch(() => null);
    }

    // If HTTP error (4xx/5xx)
    if (!response.ok) {
      const msg = result?.message || rawText || `Server returned ${response.status}`;
      if (result?.errors && typeof result.errors === "object") {
        // Example structure: { "title": ["Title is required"], "date": ["Invalid date"] }
        Object.entries(result.errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach((m) => toast.error(`${field}: ${m}`));
          } else {
            toast.error(`${field}: ${String(messages)}`);
          }
        });
      } else {
        toast.error(msg);
      }
      return; 
    }

    // If API responded with success flag false
    if (result && result.success === false) {
      const msg = result.message || "Failed to create event.";
      // show detailed field errors if any
      if (result.errors && typeof result.errors === "object") {
        Object.entries(result.errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach((m) => toast.error(`${field}: ${m}`));
          } else {
            toast.error(`${field}: ${String(messages)}`);
          }
        });
      } else {
        toast.error(msg);
      }
      return; 
    }

    const successMessage = (result && (result.message || (editId ? "Event updated successfully." : "Event created successfully.")))
      || (editId ? "Event updated successfully." : "Event created successfully.");

    toast.success(successMessage);

    // Save to localStorage (only on success)
    const base64Images = await Promise.all(images.map((file) => fileToBase64(file)));
    const existingEvents = JSON.parse(localStorage.getItem("events") || "[]");

    const createdId = result?.data?.id ?? result?.id ?? result?.event_id ?? null;
    const localEvent = {
      id: String(createdId || editId || Date.now().toString()),
      title,
      description,
      date: dateStr,
      time,
      location,
      expectedGuests: expectedGuests !== null ? String(expectedGuests) : "",
      budget:
        budgetNumber !== null && !Number.isNaN(budgetNumber)
          ? `TZS ${Number(budgetNumber).toLocaleString("en-US")}`
          : "",
      eventType: eventTypeId,
      images: editId ? [...previews.filter((p) => p.startsWith("data:image")), ...base64Images] : base64Images,
      services: recommendedServices.filter((s) => s.completed),
      createdAt: editId ? undefined : new Date().toISOString(),
    };

    if (editId) {
      const updatedEvents = existingEvents.map((e: any) => (e.id === editId ? { ...e, ...localEvent } : e));
      localStorage.setItem("events", JSON.stringify(updatedEvents));
    } else {
      localStorage.setItem("events", JSON.stringify([...existingEvents, localEvent]));
    }

    navigate(`/event-management/${localEvent.id}`);
  } catch (err: any) {
    console.error("Event API error:", err);
    toast.error(err?.message || "An unexpected error occurred while creating the event.");
  } finally {
    setIsSubmitting(false);
  }
};



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
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
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {displayedEventTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, eventType: type.id })}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-colors",
                      formData.eventType === type.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="text-2xl mb-1">
                      <EventIcon iconName={type.icon} />
                    </div>
                    <div className="text-sm font-medium">{type.name}</div>
                  </button>
                ))}
              </div>
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
                <Input
                  type="number"
                  placeholder="50"
                  value={formData.expectedGuests}
                  onChange={(e) => setFormData({ ...formData, expectedGuests: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium mb-2">Estimated Budget</label>
              <Input
                placeholder="e.g., 5000000"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
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
                  <p className="text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, or WEBP (max. 0.5MB per file)
                  </p>
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
        <Card>
          <CardHeader>
            <CardTitle>Service Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {!showRecommendations ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Get personalized service recommendations based on your event type and guest count
                </p>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    onClick={handleGenerateRecommendations}
                    disabled={!formData.eventType || !formData.expectedGuests || isFetchingRecommendations}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isFetchingRecommendations ? "Generating..." : "Generate Recommendations"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recommended Services Checklist</h3>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {recommendedServices.filter(s => s.completed).length} / {recommendedServices.length} completed
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateRecommendations}
                        disabled={isFetchingRecommendations}
                      >
                        {isFetchingRecommendations ? "Regenerating..." : "Regenerate"}
                      </Button>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleClearRecommendations}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {recommendedServices.map((service) => (
                    <div
                      key={service.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        service.completed ? "bg-green-50 border-green-200" : "bg-card border-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleServiceComplete(service.id)}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          service.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground hover:border-primary"
                        )}
                      >
                        {service.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={cn("font-medium", service.completed && "line-through text-muted-foreground")}>
                            {service.name}
                          </h4>
                          <Badge className={getPriorityColor(service.priority)}>{service.priority}</Badge>
                        </div>

                        {/* Show category and min/max price */}
                        <p className="text-sm text-muted-foreground">
                          {service.category} • {service.minPrice !== null && service.maxPrice !== null
                            ? `TZS ${service.minPrice} - TZS ${service.maxPrice}`
                            : "Price N/A"}
                        </p>

                        {/* Show recommendation description */}
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                        )}

                        {/* Show number of providers */}
                        {service.availableProviders !== undefined && (
                          <p className="text-sm font-medium mt-1">
                            {service.availableProviders > 0
                              ? `${service.availableProviders} provider(s) available`
                              : "No providers available yet"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
              type="submit"
              disabled={!formData.title || !formData.date || isSubmitting}
            >
              {isSubmitting ? (editId ? "Updating event..." : "Creating event...") : (editId ? "Update Event" : "Create Event")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEvent;

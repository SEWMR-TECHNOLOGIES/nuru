import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { cardTemplatesApi, InvitationCardTemplate } from "@/lib/api/cardTemplates";
import CardTemplatesManager from "@/components/CardTemplatesManager";

const CardTemplatesPage = () => {
  useWorkspaceMeta({
    title: "Invitation Card Templates",
    description: "Manage your custom PDF invitation card designs for events.",
  });

  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InvitationCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await cardTemplatesApi.getAll();
      if (res.success && res.data) setTemplates(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/my-events")}
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Card Templates
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Upload your own PDF invitation card designs. Guest names and QR
            codes are automatically placed on each card.
          </p>
        </div>
      </div>

      {/* Premium banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20 p-6">
        <div className="relative flex flex-col sm:flex-row items-start gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">
              Custom Invitation Cards
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Make your events stand out with personalised invitation cards.
              Upload your PDF design, and Nuru will automatically add each
              guest's name and a unique QR code for check-in. When no custom
              template is assigned, Nuru's default card is used.
            </p>
          </div>
        </div>
      </div>

      {/* Templates manager */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-24 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-60" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <CardTemplatesManager
          templates={templates}
          onRefresh={fetchTemplates}
        />
      )}
    </div>
  );
};

export default CardTemplatesPage;

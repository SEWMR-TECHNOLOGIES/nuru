import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const STARTERS = [
  { id: "smart", label: "Smart starter", desc: "Pre-filled with event title, guest name, date, location and a QR." },
  { id: "blank", label: "Blank canvas", desc: "Start from an empty canvas." },
];

export default function InvitationTemplateGalleryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/events/${eventId}/invitations/cards`)}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a starting point</h1>
          <p className="text-sm text-muted-foreground">Pick a template or start from scratch — you can change anything later.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STARTERS.map(s => (
          <Card key={s.id} className="p-6 cursor-pointer hover:border-primary transition" onClick={() => navigate(`/events/${eventId}/invitations/cards/new/edit?start=${s.id}`)}>
            <div className="aspect-[4/5] bg-muted rounded mb-4" />
            <h3 className="font-semibold">{s.label}</h3>
            <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Star } from "lucide-react";
import { invitationTemplatesApi, type InvitationCardTemplate } from "@/lib/api/invitationTemplates";
import { CardRenderer, type CardRendererHandle } from "../render/CardRenderer";
import { SAMPLE_CONTEXT } from "../render/placeholders";
import { toast } from "sonner";

export default function InvitationCardPreviewPage() {
  const { eventId, templateId } = useParams<{ eventId: string; templateId: string }>();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<InvitationCardTemplate | null>(null);
  const ref = useRef<CardRendererHandle>(null);

  useEffect(() => {
    if (!eventId || !templateId) return;
    invitationTemplatesApi.list(eventId).then(res => {
      setTpl(res.data?.find(x => x.id === templateId) || null);
    });
  }, [eventId, templateId]);

  if (!tpl) return <div className="p-6">Loading…</div>;

  const scale = Math.min(1, 800 / tpl.canvas_width);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-semibold flex-1">{tpl.name}</h1>
        <Button variant="outline" onClick={() => {
          const url = ref.current?.toDataUrl(2);
          if (!url) return;
          const a = document.createElement("a");
          a.href = url; a.download = `${tpl.name}-preview.png`; a.click();
        }}><Download className="w-4 h-4 mr-1" /> Download preview</Button>
        {!tpl.is_active && (
          <Button onClick={async () => { await invitationTemplatesApi.activate(eventId!, templateId!); toast.success("Activated"); }}>
            <Star className="w-4 h-4 mr-1" /> Activate
          </Button>
        )}
      </div>
      <div className="bg-muted/30 rounded-xl p-6 flex justify-center">
        <CardRenderer ref={ref} doc={tpl.design_json} context={SAMPLE_CONTEXT} qrPayload={SAMPLE_CONTEXT.invite_code} scale={scale} pixelRatio={2} />
      </div>
      <p className="text-xs text-muted-foreground">Preview uses sample guest data. When invited guests download, their real name and a unique QR will be rendered automatically.</p>
    </div>
  );
}

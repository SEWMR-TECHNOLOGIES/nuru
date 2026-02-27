import { useState, useCallback } from "react";
import { Upload, FileText, Trash2, Settings2, Plus, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cardTemplatesApi, InvitationCardTemplate } from "@/lib/api/cardTemplates";
import { useToast } from "@/hooks/use-toast";

interface CardTemplatesManagerProps {
  templates: InvitationCardTemplate[];
  onRefresh: () => void;
  eventId?: string;
  selectedTemplateId?: string | null;
  onAssignTemplate?: (templateId: string | null) => void;
}

const CardTemplatesManager = ({
  templates,
  onRefresh,
  eventId,
  selectedTemplateId,
  onAssignTemplate,
}: CardTemplatesManagerProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    name_placeholder_x: 50,
    name_placeholder_y: 35,
    name_font_size: 16,
    name_font_color: "#000000",
    qr_placeholder_x: 50,
    qr_placeholder_y: 75,
    qr_size: 80,
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleUpload = useCallback(async () => {
    if (!pdfFile || !uploadForm.name.trim()) {
      toast({ title: "Please provide a name and PDF file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await cardTemplatesApi.create(uploadForm, pdfFile);
      if (res.success) {
        toast({ title: "Template uploaded successfully" });
        setShowUpload(false);
        setPdfFile(null);
        setUploadForm({
          name: "", description: "",
          name_placeholder_x: 50, name_placeholder_y: 35,
          name_font_size: 16, name_font_color: "#000000",
          qr_placeholder_x: 50, qr_placeholder_y: 75, qr_size: 80,
        });
        onRefresh();
      }
    } catch {
      toast({ title: "Failed to upload template", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [pdfFile, uploadForm, toast, onRefresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await cardTemplatesApi.delete(id);
      toast({ title: "Template deleted" });
      onRefresh();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }, [toast, onRefresh]);

  const handleAssign = useCallback(async (templateId: string | null) => {
    if (!eventId) return;
    try {
      await cardTemplatesApi.assignToEvent(eventId, templateId);
      toast({ title: templateId ? "Template assigned to event" : "Reverted to default card" });
      onAssignTemplate?.(templateId);
    } catch {
      toast({ title: "Failed to assign template", variant: "destructive" });
    }
  }, [eventId, toast, onAssignTemplate]);

  const editingTemplate = templates.find((t) => t.id === showSettings);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Card Templates</h3>
          <p className="text-sm text-muted-foreground">
            Upload custom PDF invitation card designs. Guest names and QR codes are automatically added.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Upload Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No card templates yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Upload a PDF card design to get started
            </p>
            <Button onClick={() => setShowUpload(true)} variant="outline" size="sm" className="mt-4 gap-2">
              <Upload className="w-4 h-4" /> Upload Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            return (
              <Card
                key={template.id}
                className={`overflow-hidden transition-all ${
                  isSelected ? "ring-2 ring-primary" : "hover:shadow-md"
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="h-40 bg-muted/30 flex items-center justify-center cursor-pointer relative group"
                  onClick={() => setPreviewUrl(template.pdf_url)}
                >
                  {template.thumbnail_url ? (
                    <img
                      src={template.thumbnail_url}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {isSelected && (
                    <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                      <Check className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  )}
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {eventId && (
                      <Button
                        size="sm"
                        variant={isSelected ? "outline" : "default"}
                        className="text-xs h-7"
                        onClick={() => handleAssign(isSelected ? null : template.id)}
                      >
                        {isSelected ? (
                          <><X className="w-3 h-3 mr-1" /> Remove</>
                        ) : (
                          <><Check className="w-3 h-3 mr-1" /> Use for Event</>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setShowSettings(template.id)}
                    >
                      <Settings2 className="w-3 h-3 mr-1" /> Settings
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Card Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g. Elegant Wedding Card"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Brief description of the design"
                rows={2}
              />
            </div>
            <div>
              <Label>PDF File *</Label>
              <div className="mt-1">
                <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                  {pdfFile ? (
                    <span className="text-sm text-foreground font-medium">{pdfFile.name}</span>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to select PDF</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Placeholder Positions (% of page)</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name X: {uploadForm.name_placeholder_x}%</Label>
                  <Slider
                    value={[uploadForm.name_placeholder_x]}
                    onValueChange={([v]) => setUploadForm({ ...uploadForm, name_placeholder_x: v })}
                    min={0} max={100} step={1}
                  />
                </div>
                <div>
                  <Label className="text-xs">Name Y: {uploadForm.name_placeholder_y}%</Label>
                  <Slider
                    value={[uploadForm.name_placeholder_y]}
                    onValueChange={([v]) => setUploadForm({ ...uploadForm, name_placeholder_y: v })}
                    min={0} max={100} step={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">QR X: {uploadForm.qr_placeholder_x}%</Label>
                  <Slider
                    value={[uploadForm.qr_placeholder_x]}
                    onValueChange={([v]) => setUploadForm({ ...uploadForm, qr_placeholder_x: v })}
                    min={0} max={100} step={1}
                  />
                </div>
                <div>
                  <Label className="text-xs">QR Y: {uploadForm.qr_placeholder_y}%</Label>
                  <Slider
                    value={[uploadForm.qr_placeholder_y]}
                    onValueChange={([v]) => setUploadForm({ ...uploadForm, qr_placeholder_y: v })}
                    min={0} max={100} step={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Font Size</Label>
                  <Input
                    type="number"
                    value={uploadForm.name_font_size}
                    onChange={(e) => setUploadForm({ ...uploadForm, name_font_size: +e.target.value })}
                    min={8} max={72}
                  />
                </div>
                <div>
                  <Label className="text-xs">Font Color</Label>
                  <Input
                    type="color"
                    value={uploadForm.name_font_color}
                    onChange={(e) => setUploadForm({ ...uploadForm, name_font_color: e.target.value })}
                    className="h-9 p-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">QR Size (px)</Label>
                  <Input
                    type="number"
                    value={uploadForm.qr_size}
                    onChange={(e) => setUploadForm({ ...uploadForm, qr_size: +e.target.value })}
                    min={40} max={200}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={!!showSettings} onOpenChange={() => setShowSettings(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Template Settings</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{editingTemplate.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Name Position</span><span>{editingTemplate.name_placeholder_x}% x {editingTemplate.name_placeholder_y}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Font Size</span><span>{editingTemplate.name_font_size}pt</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Font Color</span><div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ backgroundColor: editingTemplate.name_font_color }} /><span>{editingTemplate.name_font_color}</span></div></div>
              <div className="flex justify-between"><span className="text-muted-foreground">QR Position</span><span>{editingTemplate.qr_placeholder_x}% x {editingTemplate.qr_placeholder_y}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">QR Size</span><span>{editingTemplate.qr_size}px</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={editingTemplate.is_active ? "default" : "secondary"}>{editingTemplate.is_active ? "Active" : "Inactive"}</Badge></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full h-[70vh] rounded border"
              title="PDF Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardTemplatesManager;

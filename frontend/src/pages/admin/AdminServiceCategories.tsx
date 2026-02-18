import { useEffect, useState, useCallback, useRef } from "react";
import { Tag, Loader2, Trash2, RefreshCw, Plus, Pencil, Check, X, ChevronDown, ChevronRight, ShieldCheck, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { adminCaches } from "@/lib/api/adminCache";
import { usePolling } from "@/hooks/usePolling";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminServiceCategories() {
  useAdminMeta("Service Categories");
  const cache = adminCaches.serviceCategories;
  const [items, setItems] = useState<any[]>(cache.data);
  const [loading, setLoading] = useState(!cache.loaded);
  const initialLoad = useRef(!cache.loaded);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Two-level expand: category → service type
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [serviceTypesMap, setServiceTypesMap] = useState<Record<string, any[]>>({});
  const [serviceTypesLoading, setServiceTypesLoading] = useState<Record<string, boolean>>({});

  // KYC per service type
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [kycMap, setKycMap] = useState<Record<string, any[]>>({});
  const [kycLoading, setKycLoading] = useState<Record<string, boolean>>({});
  const [allKycDefs, setAllKycDefs] = useState<any[]>([]);

  // Add KYC dialog
  const [addKycDialog, setAddKycDialog] = useState<{ typeId: string; typeName: string } | null>(null);
  const [selectedKycId, setSelectedKycId] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [addingKyc, setAddingKyc] = useState(false);

  const load = useCallback(async () => {
    if (initialLoad.current) setLoading(true);
    const res = await adminApi.getServiceCategories();
    if (res.success) {
      const data = Array.isArray(res.data) ? res.data : [];
      cache.set(data);
      setItems(data);
    } else if (initialLoad.current) toast.error("Failed to load categories");
    setLoading(false);
    initialLoad.current = false;
  }, []);

  useEffect(() => {
    if (!cache.loaded) initialLoad.current = true;
    load();
    // Preload KYC definitions for dropdown
    adminApi.getAllKycDefinitions().then(res => {
      if (res.success && Array.isArray(res.data)) setAllKycDefs(res.data);
    });
  }, [load]);
  usePolling(load);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await adminApi.createServiceCategory({ name: newName.trim() });
    if (res.success) { toast.success("Category added"); setNewName(""); load(); }
    else toast.error(res.message || "Failed");
    setAdding(false);
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await adminApi.updateServiceCategory(id, { name: editName.trim() });
    if (res.success) { toast.success("Category updated"); setEditId(null); load(); }
    else toast.error(res.message || "Failed");
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({ title: "Delete Category?", description: `Delete "${name}"? This may affect services using this category.`, confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    const res = await adminApi.deleteServiceCategory(id);
    if (res.success) { toast.success("Category deleted"); load(); }
    else toast.error(res.message || "Failed");
  };

  // Load service types for a category
  const loadServiceTypes = async (catId: string) => {
    setServiceTypesLoading(prev => ({ ...prev, [catId]: true }));
    const res = await adminApi.getServiceTypes(catId);
    if (res.success) {
      setServiceTypesMap(prev => ({ ...prev, [catId]: Array.isArray(res.data) ? res.data : [] }));
    } else {
      toast.error("Failed to load service types");
    }
    setServiceTypesLoading(prev => ({ ...prev, [catId]: false }));
  };

  const toggleCatExpand = (catId: string) => {
    if (expandedCatId === catId) {
      setExpandedCatId(null);
      setExpandedTypeId(null);
    } else {
      setExpandedCatId(catId);
      setExpandedTypeId(null);
      if (!serviceTypesMap[catId]) loadServiceTypes(catId);
    }
  };

  // Load KYC for a service type
  const loadKyc = async (typeId: string) => {
    setKycLoading(prev => ({ ...prev, [typeId]: true }));
    const res = await adminApi.getKycRequirements(typeId);
    if (res.success) {
      setKycMap(prev => ({ ...prev, [typeId]: Array.isArray(res.data) ? res.data : [] }));
    }
    setKycLoading(prev => ({ ...prev, [typeId]: false }));
  };

  const toggleTypeExpand = (typeId: string) => {
    if (expandedTypeId === typeId) {
      setExpandedTypeId(null);
    } else {
      setExpandedTypeId(typeId);
      if (!kycMap[typeId]) loadKyc(typeId);
    }
  };

  const handleAddKyc = async () => {
    if (!addKycDialog || !selectedKycId) return;
    setAddingKyc(true);
    const res = await adminApi.addKycRequirement(addKycDialog.typeId, {
      kyc_requirement_id: selectedKycId,
      is_mandatory: isMandatory,
    });
    if (res.success) {
      toast.success("KYC requirement added");
      setAddKycDialog(null);
      setSelectedKycId(""); setIsMandatory(true);
      loadKyc(addKycDialog.typeId);
    } else toast.error(res.message || "Failed");
    setAddingKyc(false);
  };

  const handleDeleteKyc = async (typeId: string, mappingId: string, reqName: string) => {
    const ok = await confirm({ title: "Remove KYC Requirement?", description: `Remove "${reqName}" from this service type's KYC requirements?`, confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    const res = await adminApi.deleteKycRequirement(typeId, mappingId);
    if (res.success) { toast.success("KYC requirement removed"); loadKyc(typeId); }
    else toast.error(res.message || "Failed");
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Add KYC requirement dialog */}
      <Dialog open={!!addKycDialog} onOpenChange={open => { if (!open) { setAddKycDialog(null); setSelectedKycId(""); setIsMandatory(true); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add KYC Requirement — {addKycDialog?.typeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">KYC Requirement *</label>
              <Select value={selectedKycId} onValueChange={setSelectedKycId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a KYC requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {allKycDefs.map((def: any) => (
                    <SelectItem key={def.id} value={def.id}>{def.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allKycDefs.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No KYC definitions found. Add them in the KYC master list.</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="rounded" />
              Mandatory for verification
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKycDialog(null)}>Cancel</Button>
            <Button onClick={handleAddKyc} disabled={addingKyc || !selectedKycId}>
              {addingKyc ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Service Categories</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Expand a category to view service types, then manage KYC requirements per type</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Add new */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-medium text-foreground mb-3">Add New Category</p>
        <div className="flex gap-2">
          <Input placeholder="Category name (e.g. Photography)" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Add
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left px-4 py-3"><Skeleton className="h-4 w-24" /></th><th className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></th></tr></thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Skeleton className="h-8 w-14" /><Skeleton className="h-8 w-8" /></div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Tag className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No categories found</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {items.map((cat) => (
            <div key={cat.id}>
              {/* Category row */}
              <div className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                <button onClick={() => toggleCatExpand(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {expandedCatId === cat.id
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  {editId === cat.id ? (
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleEdit(cat.id); if (e.key === "Escape") setEditId(null); }}
                      className="h-8 text-sm max-w-xs"
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-medium text-foreground">{cat.name}</span>
                  )}
                </button>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {editId === cat.id ? (
                    <>
                      <Button variant="ghost" size="sm" className="text-primary h-7 px-2" onClick={() => handleEdit(cat.id)} disabled={saving}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-7 px-2"
                    onClick={() => handleDelete(cat.id, cat.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Service Types expanded */}
              {expandedCatId === cat.id && (
                <div className="bg-muted/10 border-t border-border pl-8 pr-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Package className="w-3.5 h-3.5" /> Service Types (Sub-categories)
                  </p>
                  {serviceTypesLoading[cat.id] ? (
                    <div className="space-y-1.5">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>
                  ) : (serviceTypesMap[cat.id] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No service types in this category</p>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
                      {(serviceTypesMap[cat.id] || []).map((st: any) => (
                        <div key={st.id}>
                          <div className="flex items-center px-3 py-2 hover:bg-muted/20 transition-colors">
                            <button onClick={() => toggleTypeExpand(st.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                              {expandedTypeId === st.id
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              }
                              <span className="text-sm text-foreground">{st.name}</span>
                              {st.requires_kyc && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">KYC</span>
                              )}
                            </button>
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 h-6 px-2 text-xs shrink-0"
                              onClick={() => { setAddKycDialog({ typeId: st.id, typeName: st.name }); if (!kycMap[st.id]) loadKyc(st.id); }}>
                              <ShieldCheck className="w-3 h-3 mr-1" /> KYC
                            </Button>
                          </div>

                          {/* KYC requirements for this service type */}
                          {expandedTypeId === st.id && (
                            <div className="bg-muted/20 border-t border-border px-6 py-2 space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KYC Requirements</p>
                                <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                                  onClick={() => setAddKycDialog({ typeId: st.id, typeName: st.name })}>
                                  <Plus className="w-3 h-3 mr-1" /> Add
                                </Button>
                              </div>
                              {kycLoading[st.id] ? (
                                <div className="space-y-1">{[1,2].map(i => <Skeleton key={i} className="h-7 w-full rounded" />)}</div>
                              ) : (kycMap[st.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  No KYC requirements.{" "}
                                  <button className="text-primary underline" onClick={() => setAddKycDialog({ typeId: st.id, typeName: st.name })}>Add one</button>
                                </p>
                              ) : (
                                (kycMap[st.id] || []).map((req: any) => (
                                  <div key={req.id} className="flex items-center gap-2 bg-card border border-border rounded px-2 py-1.5">
                                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-foreground truncate">{req.name}</p>
                                    </div>
                                    {req.is_mandatory && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-warning/10 text-warning shrink-0">Required</span>
                                    )}
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-5 px-1 shrink-0"
                                      onClick={() => handleDeleteKyc(st.id, req.mapping_id || req.id, req.name)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

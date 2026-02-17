import { useEffect, useState, useCallback, useRef } from "react";
import { Tag, Loader2, Trash2, RefreshCw, Plus, Pencil, Check, X } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Service Categories</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage categories for service providers</p>
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
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category Name</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {editId === cat.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleEdit(cat.id); if (e.key === "Escape") setEditId(null); }}
                        className="h-8 text-sm" autoFocus />
                    ) : (
                      <span className="font-medium text-foreground">{cat.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {editId === cat.id ? (
                        <>
                          <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleEdit(cat.id)} disabled={saving}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(cat.id, cat.name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

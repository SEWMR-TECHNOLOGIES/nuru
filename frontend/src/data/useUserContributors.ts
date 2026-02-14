import { useState, useEffect, useCallback } from "react";
import { contributorsApi, UserContributor, ContributorQueryParams } from "@/lib/api/contributors";
import { throwApiError } from "@/lib/api/showApiErrors";

// Module-level cache so data survives unmount/remount cycles
let _contributorsCache: UserContributor[] = [];
let _contributorsHasLoaded = false;

export const useUserContributors = () => {
  const [contributors, setContributors] = useState<UserContributor[]>(_contributorsCache);
  const [loading, setLoading] = useState(!_contributorsHasLoaded);
  const [pagination, setPagination] = useState<any>(null);

  const fetchAll = useCallback(async (params?: ContributorQueryParams) => {
    if (!_contributorsHasLoaded) setLoading(true);
    try {
      let all: UserContributor[] = [];
      let page = 1;
      while (true) {
        const res = await contributorsApi.getAll({ ...params, page, limit: 100 });
        if (res.success) {
          all = [...all, ...res.data.contributors];
          const tp = res.data.pagination?.total_pages || 1;
          if (page >= tp) break;
          page++;
        } else break;
      }
      _contributorsCache = all;
      _contributorsHasLoaded = true;
      setContributors(all);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async (data: { name: string; email?: string; phone?: string; notes?: string }) => {
    const res = await contributorsApi.create(data);
    if (res.success) { await fetchAll(); return res.data; }
    throwApiError(res);
  };

  const update = async (id: string, data: Partial<UserContributor>) => {
    const res = await contributorsApi.update(id, data);
    if (res.success) { await fetchAll(); return res.data; }
    throwApiError(res);
  };

  const remove = async (id: string) => {
    const res = await contributorsApi.delete(id);
    if (res.success) { await fetchAll(); }
    else throwApiError(res);
  };

  return { contributors, loading, pagination, refetch: fetchAll, create, update, remove };
};

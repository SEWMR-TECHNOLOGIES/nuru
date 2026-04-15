export const formatNumber = (v: any) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return n.toLocaleString("en-US");
  };
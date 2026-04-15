/**
 * Generate a branded HTML report for event budget items
 */
import nuruLogoUrl from '@/assets/nuru-logo.png';
import type { EventBudgetItem } from '@/lib/api/types';

interface BudgetReportSummary {
  total_estimated: number;
  total_actual: number;
  variance: number;
  event_budget?: number;
  category_breakdown: Array<{ category: string; estimated: number; actual: number; count: number }>;
}

export const generateBudgetReportHtml = (
  eventTitle: string,
  items: EventBudgetItem[],
  summary: BudgetReportSummary
): string => {
  const currency = 'TZS';
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;
  const logoAbsoluteUrl = new URL(nuruLogoUrl, window.location.origin).href;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category) || a.item_name.localeCompare(b.item_name));

  const statusLabel = (s: string) => {
    switch (s) {
      case 'paid': return 'Paid';
      case 'deposit_paid': return 'Deposit Paid';
      default: return 'Pending';
    }
  };

  const rows = sorted.map((item, i) => {
    const est = item.estimated_cost || 0;
    const act = item.actual_cost || 0;
    const v = est - act;
    const vColor = v >= 0 ? '#16a34a' : '#dc2626';
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.category}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.item_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.vendor_name || '&mdash;'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(est)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(act)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${vColor}">${v >= 0 ? '-' : '+'}${fmt(Math.abs(v))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center"><span style="padding:2px 8px;border-radius:12px;font-size:11px;background:${item.status === 'paid' ? '#dcfce7' : item.status === 'deposit_paid' ? '#dbeafe' : '#fef3c7'};color:${item.status === 'paid' ? '#166534' : item.status === 'deposit_paid' ? '#1e40af' : '#92400e'}">${statusLabel(item.status)}</span></td>
      </tr>`;
  }).join('');

  const catRows = summary.category_breakdown.map((c, i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${c.category}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${c.count}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.estimated)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(c.actual)}</td>
    </tr>`).join('');

  const varianceColor = summary.variance >= 0 ? '#16a34a' : '#dc2626';
  const budgetCard = summary.event_budget
    ? `<div class="summary-card"><div class="label">Event Budget</div><div class="value">${fmt(summary.event_budget)}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><title>Budget Report - ${eventTitle}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
  .brand { display: flex; flex-direction: column; align-items: flex-start; }
  .brand img { height: 40px; margin-bottom: 6px; }
  .brand .slogan { font-size: 11px; color: #888; font-style: italic; }
  .header-right { text-align: right; }
  .header-right h1 { font-size: 20px; margin: 0 0 4px 0; }
  .header-right h2 { font-size: 13px; color: #666; margin: 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f8f8f8; padding: 10px 8px; text-align: left; border-bottom: 2px solid #ddd; font-size: 13px; }
  td { font-size: 13px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary-card { background: #f9fafb; border-radius: 8px; padding: 14px 18px; flex:1; min-width: 120px; }
  .summary-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 17px; font-weight: bold; margin-top: 4px; }
  tfoot td { font-weight: bold; border-top: 2px solid #333; padding: 10px 8px; }
  .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${logoAbsoluteUrl}" alt="Nuru" />
      <span class="slogan">Plan Smarter</span>
    </div>
    <div class="header-right">
      <h1>Budget Report</h1>
      <h2>${eventTitle} &mdash; ${dateStr}, ${timeStr}</h2>
    </div>
  </div>

  <div class="summary">
    ${budgetCard}
    <div class="summary-card"><div class="label">Total Estimated</div><div class="value">${fmt(summary.total_estimated)}</div></div>
    <div class="summary-card"><div class="label">Total Actual</div><div class="value">${fmt(summary.total_actual)}</div></div>
    <div class="summary-card"><div class="label">Variance</div><div class="value" style="color:${varianceColor}">${summary.variance >= 0 ? '-' : '+'}${fmt(Math.abs(summary.variance))}</div></div>
  </div>

  <h3 style="font-size:14px;margin-bottom:8px">Category Summary</h3>
  <table style="margin-bottom:24px">
    <thead><tr><th style="text-align:center">S/N</th><th>Category</th><th style="text-align:center">Items</th><th style="text-align:right">Estimated</th><th style="text-align:right">Actual</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h3 style="font-size:14px;margin-bottom:8px">Budget Items</h3>
  <table>
    <thead>
      <tr>
        <th>S/N</th>
        <th>Category</th>
        <th>Item</th>
        <th>Vendor</th>
        <th style="text-align:right">Estimated</th>
        <th style="text-align:right">Actual</th>
        <th style="text-align:right">Variance</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total (${items.length} items)</td>
        <td style="text-align:right">${fmt(summary.total_estimated)}</td>
        <td style="text-align:right">${fmt(summary.total_actual)}</td>
        <td style="text-align:right;color:${varianceColor}">${summary.variance >= 0 ? '-' : '+'}${fmt(Math.abs(summary.variance))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Generated by Nuru Events Workspace &middot; &copy; ${new Date().getFullYear()} Nuru | SEWMR TECHNOLOGIES</div>
</body></html>`;
};

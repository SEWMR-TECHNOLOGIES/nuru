import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';

export interface ParsedSegment {
  type: 'text' | 'card';
  text?: string;
  kind?: string;
  payload?: any;
}

const FENCE_RE = /```nuru-card:([a-z_]+)\s*\n([\s\S]*?)\n```/g;

export function parseAssistantContent(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(content)) !== null) {
    if (m.index > last) {
      const t = content.slice(last, m.index);
      if (t.trim()) segments.push({ type: 'text', text: t });
    }
    let payload: any = {};
    try {
      payload = JSON.parse(m[2]);
    } catch {
      payload = {};
    }
    segments.push({ type: 'card', kind: m[1], payload });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const t = content.slice(last);
    if (t.trim()) segments.push({ type: 'text', text: t });
  }
  if (segments.length === 0) segments.push({ type: 'text', text: content });
  return segments;
}

const MARKDOWN_COMPONENTS = {
  table: ({ children }: any) => (
    <div className="my-2 -mx-1 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }: any) => (
    <th className="px-2 py-1.5 text-left font-semibold text-foreground/80 whitespace-nowrap border-b border-border">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="px-2 py-1.5 text-foreground/70 whitespace-nowrap border-b border-border/50">{children}</td>
  ),
  p: ({ children }: any) => <p className="my-1">{children}</p>,
  ul: ({ children }: any) => <ul className="my-1 ml-3 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1 ml-3 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-[13px]">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-70">{children}</a>
  ),
};

export function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS as any}>
      {content}
    </ReactMarkdown>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 my-2">
      {children}
    </div>
  );
}

function ResultsListCard({ payload }: { payload: any }) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) return null;
  return (
    <CardShell>
      {payload.title && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{payload.title}</div>}
      <div className="space-y-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="flex items-start gap-2.5 pb-2 border-b border-border/50 last:border-0 last:pb-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[13px] text-foreground truncate">{it.title}</span>
                {it.badge && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{it.badge}</Badge>}
              </div>
              {it.subtitle && <div className="text-[11px] text-primary font-semibold mt-0.5">{it.subtitle}</div>}
              {it.meta && <div className="text-[10.5px] text-muted-foreground mt-0.5">{it.meta}</div>}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function TableCard({ payload }: { payload: any }) {
  const headers: string[] = Array.isArray(payload?.headers) ? payload.headers : [];
  const rows: string[][] = Array.isArray(payload?.rows) ? payload.rows : [];
  if (headers.length === 0) return null;
  const looksNumeric = (v: string) => {
    const t = (v || '').trim().replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    return t.length > 0 && !isNaN(Number(t));
  };
  const numericCols = headers.map((_, i) => {
    let n = 0, t = 0;
    for (const r of rows) {
      if (i < r.length && r[i]) { t++; if (looksNumeric(r[i])) n++; }
    }
    return t > 0 && n / t >= 0.6;
  });
  return (
    <CardShell>
      {payload.title && <div className="text-[12px] font-semibold mb-2">{payload.title}</div>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-[11px]">
          <thead className="bg-muted/60">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-2 py-1.5 font-semibold text-foreground/80 whitespace-nowrap border-b border-border ${numericCols[i] ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-1.5 text-foreground/80 whitespace-nowrap border-b border-border/50 ${numericCols[j] ? 'text-right tabular-nums' : 'text-left'}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

function InputPromptCard({ payload, onSubmit }: { payload: any; onSubmit: (text: string) => void }) {
  const [v, setV] = useState('');
  const label = payload?.label || 'Please provide a value';
  const field = payload?.field || 'value';
  const placeholder = payload?.placeholder || 'Type your answer…';
  const type = payload?.input_type || 'text';
  const inputType = type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : type === 'date' ? 'date' : 'text';
  return (
    <CardShell>
      <div className="text-[13px] font-semibold mb-2">{label}</div>
      <div className="flex gap-2">
        <Input
          type={inputType}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm"
          autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onSubmit(`${field}: ${v.trim()}`); setV(''); } }}
        />
        <Button
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => { if (v.trim()) { onSubmit(`${field}: ${v.trim()}`); setV(''); } }}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </CardShell>
  );
}

function ConfirmCard({ payload, onSubmit }: { payload: any; onSubmit: (text: string) => void }) {
  const question = payload?.question || 'Are you sure?';
  return (
    <CardShell>
      <div className="text-[13px] font-semibold mb-3">{question}</div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onSubmit('No, cancel.')}>No</Button>
        <Button size="sm" onClick={() => onSubmit('Yes, please proceed.')}>Yes</Button>
      </div>
    </CardShell>
  );
}

function MultiInputPromptCard({ payload, onSubmit }: { payload: any; onSubmit: (text: string) => void }) {
  const fields: any[] = Array.isArray(payload?.fields) ? payload.fields : [];
  const title = payload?.title;
  const submitLabel = payload?.submit_label || 'Continue';
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const k = f.field || 'value';
      if (f.default != null) init[k] = String(f.default);
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parts: string[] = [];
    for (const f of fields) {
      const k = f.field || 'value';
      const label = f.label || k;
      const v = (values[k] || '').trim();
      if (!v) {
        if (f.required) { setError(`${label} is required`); return; }
        continue;
      }
      parts.push(`${label}: ${v}`);
    }
    if (parts.length === 0) return;
    setError(null);
    onSubmit(parts.join('\n'));
  };

  return (
    <CardShell>
      {title && <div className="text-[13px] font-bold mb-3">{title}</div>}
      <div className="space-y-3">
        {fields.map((f, i) => {
          const key = f.field || `f${i}`;
          const label = f.label || 'Value';
          const required = f.required === true;
          const type = f.input_type || 'text';
          const placeholder = f.placeholder || 'Type here…';
          if (type === 'choice') {
            const options: string[] = Array.isArray(f.options) ? f.options : [];
            return (
              <div key={i} className="space-y-1.5">
                <div className="text-[11.5px] font-semibold">{label}{required && <span className="text-primary"> *</span>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((opt, j) => {
                    const active = values[key] === opt;
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setValues((p) => ({ ...p, [key]: opt }))}
                        className={`text-[11.5px] px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          const inputType = type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'phone' ? 'tel' : type === 'date' ? 'date' : 'text';
          return (
            <div key={i} className="space-y-1.5">
              <div className="text-[11.5px] font-semibold">{label}{required && <span className="text-primary"> *</span>}</div>
              <Input
                type={inputType}
                value={values[key] || ''}
                onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="h-9 text-sm"
                autoComplete="off"
              />
            </div>
          );
        })}
        {error && <div className="text-[11px] text-destructive">{error}</div>}
        <Button onClick={submit} className="w-full h-9 text-[12.5px] font-semibold">{submitLabel}</Button>
      </div>
    </CardShell>
  );
}

export function CardRenderer({ kind, payload, onSubmit }: { kind: string; payload: any; onSubmit: (text: string) => void }) {
  switch (kind) {
    case 'results_list':
    case 'events_list':
    case 'tickets_list':
      return <ResultsListCard payload={payload} />;
    case 'table':
      return <TableCard payload={payload} />;
    case 'input_prompt':
      return <InputPromptCard payload={payload} onSubmit={onSubmit} />;
    case 'multi_input_prompt':
      return <MultiInputPromptCard payload={payload} onSubmit={onSubmit} />;
    case 'confirm_action':
      return <ConfirmCard payload={payload} onSubmit={onSubmit} />;
    case 'contribution_progress':
      return <ResultsListCard payload={{ title: payload?.event_name, items: [{ title: `${payload?.currency || 'TZS'} ${payload?.paid?.toLocaleString?.() || payload?.paid || 0} paid`, subtitle: `of ${payload?.currency || 'TZS'} ${payload?.pledged?.toLocaleString?.() || payload?.pledged || 0} pledged`, meta: `${payload?.percent ?? 0}% complete` }] }} />;
    default:
      return null;
  }
}

export function useParsedSegments(content: string): ParsedSegment[] {
  return useMemo(() => parseAssistantContent(content), [content]);
}

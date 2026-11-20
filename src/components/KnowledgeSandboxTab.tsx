import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Send,
  ShieldOff,
  Trash2,
  X,
} from 'lucide-react';
import { SANDBOX_SAMPLE_QUERIES } from '../data/knowledgeBase';
import type { PolicyChunk, RagQueryResponse } from '../types/compliance';

interface KnowledgeSandboxTabProps {
  chunks: PolicyChunk[];
  queryInput: string;
  onQueryInputChange: (val: string) => void;
  sandboxResult: RagQueryResponse | null;
  isQuerying: boolean;
  queryError: string | null;
  isAddRuleOpen: boolean;
  onToggleAddRule: (open: boolean) => void;
  onAddPolicyRule: (rule: Omit<PolicyChunk, 'chunk_id' | 'effective_date' | 'isCustom'>) => void;
  onDeleteCustomRule: (chunkId: string) => void;
  onRunRagQuery: (overrideQuery?: string) => void;
  onInspectCitation: (chunkId: string) => void;
}

export function KnowledgeSandboxTab({
  chunks,
  queryInput,
  onQueryInputChange,
  sandboxResult,
  isQuerying,
  queryError,
  isAddRuleOpen,
  onToggleAddRule,
  onAddPolicyRule,
  onDeleteCustomRule,
  onRunRagQuery,
  onInspectCitation,
}: KnowledgeSandboxTabProps) {
  const [corpusSearch, setCorpusSearch] = useState('');
  const [sourceDoc, setSourceDoc] = useState('1Pay Custom Fleet Policy');
  const [section, setSection] = useState('Sec 8.1');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredChunks = useMemo(() => {
    const q = corpusSearch.trim().toLowerCase();
    if (!q) return chunks;
    return chunks.filter(
      (c) =>
        c.chunk_id.toLowerCase().includes(q) ||
        c.source_doc.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q)
    );
  }, [chunks, corpusSearch]);

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceDoc.trim() || !section.trim() || !title.trim() || !content.trim()) {
      setFormError('All policy fields are required before indexing.');
      return;
    }
    onAddPolicyRule({
      source_doc: sourceDoc.trim(),
      section: section.trim(),
      title: title.trim(),
      content: content.trim(),
    });
    setTitle('');
    setContent('');
    setFormError(null);
    onToggleAddRule(false);
  };

  // Render answer text with clickable inline [DOC-XXX] buttons
  const renderCitedAnswer = (text: string) => {
    const parts = text.split(/(\[DOC-\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(DOC-\d+)\]$/);
      if (match) {
        const cid = match[1];
        return (
          <button
            key={`${cid}-${idx}`}
            type="button"
            onClick={() => onInspectCitation(cid)}
            className="inline-flex items-center font-mono text-xs font-semibold px-1.5 py-0.25 mx-0.5 bg-slate-100 border border-slate-300 text-slate-900 hover:border-[#1E3A8A] hover:text-[#1E3A8A] rounded align-baseline transition-colors"
          >
            [{cid}]
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            RAG Knowledge Base & Retrieval Sandbox
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{chunks.length} Indexed Policy Chunks</span>
            <span aria-hidden="true">·</span>
            <span>Hybrid Semantic (Gemini Embeddings) + Lexical Scoring</span>
            <span aria-hidden="true">·</span>
            <span>Strict Zero-Fabrication Refusal Guardrail</span>
          </div>
        </div>
      </div>

      {/* Add Custom Policy Rule Form (Collapsible) */}
      {isAddRuleOpen && (
        <form
          onSubmit={handleSubmitRule}
          className="bg-white border border-slate-300 rounded-md p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Index Custom Enterprise Policy Rule
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                New rules are immediately available to both the Retrieval Sandbox and Tab 1 Batch
                Reconciliation audits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleAddRule(false)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
              aria-label="Close add rule form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Source Document
              </label>
              <input
                type="text"
                value={sourceDoc}
                onChange={(e) => setSourceDoc(e.target.value)}
                placeholder="e.g., 1Pay B2B Fleet SLA"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Section Reference
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g., Sec 8.1"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rule Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Nighttime Fuel Swipe Limit"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Verbatim Regulatory / SLA Policy Clause
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the exact policy condition, threshold, and required compliance action..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          {formError && <p className="text-xs text-red-700">{formError}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onToggleAddRule(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Index Policy Chunk</span>
            </button>
          </div>
        </form>
      )}

      {/* Two-Column Split: Corpus Explorer (Left) + Retrieval Sandbox (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Indexed Knowledge Base */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Indexed Policy Corpus ({chunks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onToggleAddRule(!isAddRuleOpen)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1E3A8A] hover:bg-blue-50 rounded transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </button>
          </div>

          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={corpusSearch}
                onChange={(e) => setCorpusSearch(e.target.value)}
                placeholder="Filter chunks by DOC ID, circular, or keyword..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 max-h-[640px] overflow-y-auto">
            {filteredChunks.map((chunk) => (
              <div key={chunk.chunk_id} className="p-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">
                      [{chunk.chunk_id}]
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{chunk.source_doc}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{chunk.section}</span>
                  </div>
                  {chunk.isCustom && (
                    <button
                      type="button"
                      onClick={() => onDeleteCustomRule(chunk.chunk_id)}
                      className="p-1 text-slate-400 hover:text-red-700 rounded transition-colors"
                      title={`Remove custom rule ${chunk.chunk_id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-slate-900 mt-1.5">{chunk.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">{chunk.content}</p>
              </div>
            ))}

            {filteredChunks.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No indexed policy chunks match your filter.
              </div>
            )}
          </div>
        </div>

        {/* Right: Retrieval & Citation Sandbox */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Compliance Query & Grounding Sandbox
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect exact hybrid retrieval relevance scores alongside Gemini&apos;s strictly cited
              policy determination.
            </p>
          </div>

          <div className="p-5 space-y-4 border-b border-slate-200 bg-slate-50/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRunRagQuery();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => onQueryInputChange(e.target.value)}
                placeholder="Ask an NPCI NETC or 1Pay Fleet SLA compliance question..."
                className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A8A]"
              />
              <button
                type="submit"
                disabled={isQuerying || !queryInput.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {isQuerying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Retrieving...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Run Retrieval</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Compliance Test Queries */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500">
                Sample B2B Compliance Queries (including out-of-scope guardrail test)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SANDBOX_SAMPLE_QUERIES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onQueryInputChange(sample);
                      onRunRagQuery(sample);
                    }}
                    disabled={isQuerying}
                    className="text-left text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:border-[#1E3A8A] hover:text-[#1E3A8A] rounded transition-colors disabled:opacity-50"
                  >
                    {sample.length > 74 ? `${sample.slice(0, 74)}…` : sample}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sandbox Error */}
          {queryError && (
            <div className="m-5 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Retrieval Query Error</p>
                <p className="text-red-700 mt-0.5">{queryError}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isQuerying && !sandboxResult && !queryError && (
            <div className="px-6 py-14 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">
                No compliance query executed yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Select a sample query above or ask about NETC Annual Pass rules, duplicate RFID
                chargebacks, Exception Code 08, fuel corridor limits, or an out-of-scope topic to
                inspect live relevance scores and strict citations.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isQuerying && (
            <div className="px-6 py-14 flex flex-col items-center justify-center text-center space-y-2.5">
              <Loader2 className="w-5 h-5 text-[#1E3A8A] animate-spin" />
              <p className="text-xs font-medium text-slate-900">
                Embedding query & ranking policy chunks via Gemini...
              </p>
              <p className="text-[11px] text-slate-500">
                Computing cosine similarity + lexical coverage across {chunks.length} indexed rules.
              </p>
            </div>
          )}

          {/* Side-by-Side Retrieved Chunks + Grounded Answer */}
          {!isQuerying && sandboxResult && (
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Column A: Retrieved Chunks & Relevance Scores */}
              <div className="md:col-span-5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Retrieved Chunks & Scores
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Top {sandboxResult.retrieved_chunks.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {sandboxResult.retrieved_chunks.map((rc, index) => {
                    const isCited = sandboxResult.cited_chunk_ids.includes(rc.chunk_id);
                    const pct = Math.round(rc.combined_score * 100);
                    return (
                      <div key={rc.chunk_id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectCitation(rc.chunk_id)}
                            className="text-xs font-mono font-semibold text-slate-900 hover:text-[#1E3A8A] flex items-center gap-1.5"
                          >
                            <span>[{rc.chunk_id}]</span>
                            {isCited && (
                              <span className="font-sans text-[11px] font-medium text-emerald-700">
                                · Cited
                              </span>
                            )}
                          </button>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              index === 0 && pct >= 55 ? 'text-[#1E3A8A]' : 'text-slate-600'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>

                        <p className="text-[11px] font-medium text-slate-700 truncate">
                          {rc.title}
                        </p>

                        {/* Relevance Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isCited
                                ? 'bg-emerald-600'
                                : pct >= 50
                                  ? 'bg-[#1E3A8A]'
                                  : 'bg-slate-300'
                            }`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 tabular-nums">
                          <span>Semantic {(rc.semantic_score * 100).toFixed(0)}%</span>
                          <span aria-hidden="true">·</span>
                          <span>Lexical {(rc.lexical_score * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column B: Strictly Cited Gemini Determination */}
              <div className="md:col-span-7 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {sandboxResult.grounded ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Grounded in Indexed Corpus</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>Refused — Rule Not in Knowledge Base</span>
                      </span>
                    )}

                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {sandboxResult.latency_ms} ms
                    </span>
                  </div>

                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                    {renderCitedAnswer(sandboxResult.answer)}
                  </div>

                  {sandboxResult.confidence_note && (
                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 leading-relaxed">
                      {sandboxResult.confidence_note}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500">Cited Clauses:</span>
                    {sandboxResult.cited_chunk_ids.length > 0 ? (
                      sandboxResult.cited_chunk_ids.map((cid) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => onInspectCitation(cid)}
                          className="font-mono text-[11px] font-semibold px-1.5 py-0.5 bg-slate-50 border border-slate-300 text-slate-900 hover:border-[#1E3A8A] hover:text-[#1E3A8A] rounded transition-colors"
                        >
                          [{cid}]
                        </button>
                      ))
                    ) : (
                      <span className="font-mono text-slate-500">None (Zero Fabrications)</span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {sandboxResult.model}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

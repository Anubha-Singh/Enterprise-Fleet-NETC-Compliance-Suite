import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import type { PolicyChunk } from '../types/compliance';

interface PolicyInspectorDrawerProps {
  chunk: PolicyChunk | null;
  onClose: () => void;
  onTestInSandbox: (chunk: PolicyChunk) => void;
}

export function PolicyInspectorDrawer({
  chunk,
  onClose,
  onTestInSandbox,
}: PolicyInspectorDrawerProps) {
  if (!chunk) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-inspector-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-900">
                  [{chunk.chunk_id}]
                </span>
                <span aria-hidden="true">·</span>
                <span>{chunk.source_doc}</span>
                <span aria-hidden="true">·</span>
                <span>{chunk.section}</span>
              </div>
              <h2
                id="policy-inspector-title"
                className="text-lg font-semibold text-slate-900 leading-snug"
              >
                {chunk.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-700"
              aria-label="Close policy inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 pb-5 border-b border-slate-200 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Source Circular / SLA</p>
                <p className="font-medium text-slate-900">{chunk.source_doc}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Clause Reference</p>
                <p className="font-mono font-medium text-slate-900">{chunk.section}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Effective Date</p>
                <p className="font-mono text-slate-900 tabular-nums">{chunk.effective_date}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Index Origin</p>
                <p className="text-slate-900">
                  {chunk.isCustom ? 'Custom Enterprise Rule' : 'NPCI / 1Pay Standard Corpus'}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2.5 text-xs font-medium text-slate-600">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Verbatim Indexed Clause</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-sm leading-relaxed text-slate-800">
                {chunk.content}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onTestInSandbox(chunk);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Test Clause in Sandbox</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

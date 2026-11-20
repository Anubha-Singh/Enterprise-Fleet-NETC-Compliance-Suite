import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { EvalCaseTrace, EvalSuiteResponse } from '../types/compliance';

interface RagEvalsTabProps {
  evalSuite: EvalSuiteResponse | null;
  isRunningEvals: boolean;
  evalError: string | null;
  onRunEvals: () => void;
  onInspectCitation: (chunkId: string) => void;
}

const BENCHMARK_SPEC = [
  {
    eval_id: 'EVAL-01',
    name: 'State Highway Annual Pass Exclusion',
    category: 'Retrieval Recall & Citation',
    expected: '[DOC-102]',
    query:
      'Can Apex Freight apply an NETC Annual Pass on Maharashtra State Highway SH-27 or private expressways, or how must it be billed?',
  },
  {
    eval_id: 'EVAL-02',
    name: 'Off-Corridor Fuel Card Swipe Without GST Invoice',
    category: 'Retrieval Recall & Citation',
    expected: '[DOC-104]',
    query:
      'A driver swiped ₹7,800 on a corporate prepaid fuel card 210 km off the assigned trip corridor without a GSTIN tax invoice. What does the 1Pay Fleet SLA mandate?',
  },
  {
    eval_id: 'EVAL-03',
    name: 'Duplicate RFID Plaza Chargeback Eligibility',
    category: 'Retrieval Recall & Citation',
    expected: '[DOC-101]',
    query:
      'Vehicle MH-04-DK-9910 incurred two settled toll debits at Khalapur NH-48 Plaza 3 minutes apart with distinct RRNs. What chargeback reason code and window apply?',
  },
  {
    eval_id: 'EVAL-04',
    name: 'Pending Authorization Pre-Arbitration Block',
    category: 'Retrieval Recall & Citation',
    expected: '[DOC-106]',
    query:
      'Can our ops team generate and submit a formal NPCI chargeback packet while a plaza transaction is still in PENDING settlement status?',
  },
  {
    eval_id: 'EVAL-05',
    name: 'Out-of-Scope Cross-Border Customs Guardrail',
    category: 'Citation Faithfulness (Refusal)',
    expected: 'Refusal (0 Citations)',
    query:
      'What is the NPCI reimbursement ceiling for international cross-border customs brokerage duties and overnight driver detention allowances on Nepal freight corridors?',
  },
];

export function RagEvalsTab({
  evalSuite,
  isRunningEvals,
  evalError,
  onRunEvals,
  onInspectCitation,
}: RagEvalsTabProps) {
  const [selectedEvalId, setSelectedEvalId] = useState<string>('EVAL-01');

  const selectedTrace: EvalCaseTrace | null =
    evalSuite?.cases.find((c) => c.eval_id === selectedEvalId) ??
    evalSuite?.cases[0] ??
    null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            RAG Evals & Citation Accuracy
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>5-Case Deterministic Compliance Benchmark</span>
            <span aria-hidden="true">·</span>
            <span>Measures Top-2 Retrieval Recall, Zero-Fabrication Faithfulness & Latency</span>
          </div>
        </div>
        {evalSuite && (
          <div className="text-xs font-mono text-slate-500 tabular-nums">
            Run {evalSuite.run_id} · {evalSuite.model} + {evalSuite.embedding_model}
          </div>
        )}
      </div>

      {/* 4-Column Eval KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Overall Suite Pass Rate</p>
          <p className="text-xl font-semibold font-mono tabular-nums mt-1 text-slate-900">
            {evalSuite ? `${evalSuite.pass_rate_pct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {evalSuite
              ? `${evalSuite.passed_cases} of ${evalSuite.total_cases} benchmark cases passed`
              : '5 cases configured · Ready to execute'}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Retrieval Recall@2</p>
          <p className="text-xl font-semibold font-mono tabular-nums mt-1 text-emerald-700">
            {evalSuite ? `${evalSuite.retrieval_recall_pct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Expected policy chunk ranked in Top-2
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Citation Faithfulness</p>
          <p className="text-xl font-semibold font-mono tabular-nums mt-1 text-[#1E3A8A]">
            {evalSuite ? `${evalSuite.citation_faithfulness_pct}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Zero fabricated clauses & strict refusal check
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Mean End-to-End Latency</p>
          <p className="text-xl font-semibold font-mono tabular-nums mt-1 text-slate-900">
            {evalSuite ? `${evalSuite.avg_latency_ms} ms` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Embedding + hybrid ranking + Gemini synthesis
          </p>
        </div>
      </div>

      {/* Error State */}
      {evalError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Eval Suite Execution Error</p>
              <p className="text-red-700 mt-0.5">{evalError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunEvals}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
          >
            Retry Suite
          </button>
        </div>
      )}

      {/* Split Layout: Eval Benchmark Table + Inspectable Trace Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 5-Case Benchmark Matrix */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Evaluation Benchmark Cases (5)
              </h2>
            </div>
            <button
              type="button"
              onClick={onRunEvals}
              disabled={isRunningEvals}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isRunningEvals ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running 5 Cases...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>{evalSuite ? 'Re-Run Suite' : 'Run 5-Case Eval Suite'}</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <th className="py-2.5 pl-4 pr-3 whitespace-nowrap">Case ID</th>
                  <th className="py-2.5 px-3">Scenario & Expected Target</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Recall</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Faithfulness</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Latency</th>
                  <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {BENCHMARK_SPEC.map((spec) => {
                  const trace = evalSuite?.cases.find((c) => c.eval_id === spec.eval_id);
                  const isSelected = selectedEvalId === spec.eval_id;

                  return (
                    <tr
                      key={spec.eval_id}
                      onClick={() => setSelectedEvalId(spec.eval_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap align-top">
                        {spec.eval_id}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-medium text-slate-900">{spec.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{spec.category}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono text-slate-700">Target: {spec.expected}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {isRunningEvals ? (
                          <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                        ) : trace ? (
                          trace.retrieval_recall_pass ? (
                            <span className="text-emerald-700 font-medium">Pass</span>
                          ) : (
                            <span className="text-red-700 font-medium">Fail</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {isRunningEvals ? (
                          <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                        ) : trace ? (
                          trace.citation_faithfulness_pass ? (
                            <span className="text-emerald-700 font-medium">Pass</span>
                          ) : (
                            <span className="text-red-700 font-medium">Fail</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {isRunningEvals ? (
                          <div className="h-4 w-14 bg-slate-200 rounded animate-pulse ml-auto" />
                        ) : trace ? (
                          `${trace.latency_ms} ms`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                        {isRunningEvals ? (
                          <div className="h-4 w-14 bg-slate-200 rounded animate-pulse ml-auto" />
                        ) : trace ? (
                          trace.overall_pass ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>PASS</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>FAIL</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Inspectable Trace Viewer */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Inspectable Execution Trace
            </h2>
            <span className="font-mono text-xs text-slate-500">{selectedEvalId}</span>
          </div>

          {isRunningEvals ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center space-y-2.5">
              <Loader2 className="w-5 h-5 text-[#1E3A8A] animate-spin" />
              <p className="text-xs font-medium text-slate-900">
                Executing live RAG evaluation suite...
              </p>
              <p className="text-[11px] text-slate-500">
                Measuring retrieval recall, inline [DOC-XXX] citation verification, and refusal
                guardrails.
              </p>
            </div>
          ) : selectedTrace ? (
            <div className="p-5 space-y-5 text-xs">
              {/* Trace Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{selectedTrace.name}</p>
                  <p className="text-slate-500 mt-0.5">
                    Expected Target:{' '}
                    <span className="font-mono font-medium text-slate-800">
                      {selectedTrace.expected_chunk_id
                        ? `[${selectedTrace.expected_chunk_id}]`
                        : 'Strict Refusal (No Citation)'}
                    </span>
                  </p>
                </div>
                {selectedTrace.overall_pass ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PASS</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-700 shrink-0">
                    <XCircle className="w-4 h-4" />
                    <span>FAIL</span>
                  </span>
                )}
              </div>

              {selectedTrace.failure_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
                  <span className="font-semibold">Failure Detail: </span>
                  {selectedTrace.failure_reason}
                </div>
              )}

              {/* Prompt Query */}
              <div>
                <p className="font-semibold text-slate-700 mb-1">Test Query</p>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-800 leading-relaxed">
                  {selectedTrace.query}
                </p>
              </div>

              {/* Retrieved Ranking */}
              <div>
                <p className="font-semibold text-slate-700 mb-2">Top Retrieved Policy Chunks</p>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded">
                  {selectedTrace.retrieved_chunks.map((rc, idx) => {
                    const isTarget = rc.chunk_id === selectedTrace.expected_chunk_id;
                    return (
                      <div
                        key={rc.chunk_id}
                        className="px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-400 tabular-nums">#{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => onInspectCitation(rc.chunk_id)}
                            className="font-mono font-semibold text-slate-900 hover:text-[#1E3A8A] shrink-0"
                          >
                            [{rc.chunk_id}]
                          </button>
                          <span className="text-slate-600 truncate">{rc.title}</span>
                          {isTarget && (
                            <span className="text-emerald-700 font-medium shrink-0">· Target</span>
                          )}
                        </div>
                        <span className="font-mono tabular-nums font-medium text-slate-800 shrink-0">
                          {(rc.combined_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Faithfulness & Grounding Assertions */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <p className="text-[11px] text-slate-500">Grounding State</p>
                  <p className="font-mono font-semibold text-slate-900 mt-0.5">
                    {selectedTrace.actual_grounded ? 'GROUNDED' : 'REFUSED (OUT_OF_SCOPE)'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <p className="text-[11px] text-slate-500">Fabricated Clauses</p>
                  <p
                    className={`font-mono font-semibold mt-0.5 tabular-nums ${
                      selectedTrace.fabricated_citations.length === 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {selectedTrace.fabricated_citations.length} detected
                  </p>
                </div>
              </div>

              {/* Model Output */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-700">Gemini Response Output</p>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {selectedTrace.latency_ms} ms
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedTrace.answer}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-2.5">
              <p className="text-sm font-medium text-slate-900">
                Execute the 5-Case Eval Suite to inspect traces
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click any case row after running to inspect exact retrieval scores, inline
                citations, latency, and hallucination guardrail verdicts.
              </p>
              <button
                type="button"
                onClick={onRunEvals}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors mt-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run 5-Case Eval Suite</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

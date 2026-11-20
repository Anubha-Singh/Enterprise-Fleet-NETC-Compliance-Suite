import { Fragment, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Play,
  Scale,
  Search,
} from 'lucide-react';
import { CLIENT_PROFILE } from '../data/knowledgeBase';
import type {
  AuditClassification,
  BatchAuditResponse,
  FleetTransaction,
  RowAuditResult,
} from '../types/compliance';

interface BatchReconciliationTabProps {
  transactions: FleetTransaction[];
  auditData: BatchAuditResponse | null;
  isAuditing: boolean;
  auditingTxnIds: string[];
  auditError: string | null;
  onRunAudit: () => void;
  onRunSingleRowAudit: (txn: FleetTransaction) => void;
  onInspectCitation: (chunkId: string) => void;
  onGenerateDisputePacket: (txn: FleetTransaction, audit: RowAuditResult) => void;
}

type FilterOption = 'ALL' | AuditClassification;

const FILTER_LABELS: Array<{ id: FilterOption; label: string }> = [
  { id: 'ALL', label: 'All Records' },
  { id: 'COMPLIANT', label: 'Compliant' },
  { id: 'DISPUTE_ELIGIBLE', label: 'Dispute Eligible' },
  { id: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { id: 'HOLD_PENDING', label: 'Hold Pending' },
];

export function BatchReconciliationTab({
  transactions,
  auditData,
  isAuditing,
  auditingTxnIds,
  auditError,
  onRunAudit,
  onRunSingleRowAudit,
  onInspectCitation,
  onGenerateDisputePacket,
}: BatchReconciliationTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<FilterOption>('ALL');
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);

  const auditMap = useMemo(() => {
    const map = new Map<string, RowAuditResult>();
    if (auditData) {
      for (const item of auditData.results) {
        map.set(item.txn_id, item);
      }
    }
    return map;
  }, [auditData]);

  const metrics = useMemo(() => {
    const grossTotal = transactions.reduce((sum, t) => sum + t.amount_inr, 0);
    let disputeCount = 0;
    let disputeAmount = 0;
    let violationCount = 0;
    let violationAmount = 0;
    let holdCount = 0;
    let holdAmount = 0;
    let compliantCount = 0;

    for (const txn of transactions) {
      const audit = auditMap.get(txn.txn_id);
      if (!audit) continue;
      if (audit.classification === 'DISPUTE_ELIGIBLE') {
        disputeCount += 1;
        disputeAmount += txn.amount_inr;
      } else if (audit.classification === 'POLICY_VIOLATION') {
        violationCount += 1;
        violationAmount += txn.amount_inr;
      } else if (audit.classification === 'HOLD_PENDING') {
        holdCount += 1;
        holdAmount += txn.amount_inr;
      } else if (audit.classification === 'COMPLIANT') {
        compliantCount += 1;
      }
    }

    return {
      grossTotal,
      disputeCount,
      disputeAmount,
      violationCount,
      violationAmount,
      holdCount,
      holdAmount,
      compliantCount,
    };
  }, [transactions, auditMap]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((txn) => {
      const audit = auditMap.get(txn.txn_id);
      if (classificationFilter !== 'ALL') {
        if (!audit || audit.classification !== classificationFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        txn.txn_id.toLowerCase().includes(q) ||
        txn.vehicle_reg.toLowerCase().includes(q) ||
        txn.plaza_or_merchant.toLowerCase().includes(q) ||
        txn.notes.toLowerCase().includes(q) ||
        txn.rrn.toLowerCase().includes(q) ||
        (audit?.primary_citation.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, auditMap, searchQuery, classificationFilter]);

  const handleExportCsv = () => {
    const headers = [
      'TXN_ID',
      'VEHICLE_REG',
      'PLAZA_OR_MERCHANT',
      'AMOUNT_INR',
      'SETTLEMENT_STATUS',
      'TIMESTAMP',
      'RRN',
      'CLASSIFICATION',
      'PRIMARY_CITATION',
      'CHARGEBACK_CODE',
      'RATIONALE',
    ];
    const rows = transactions.map((txn) => {
      const a = auditMap.get(txn.txn_id);
      return [
        txn.txn_id,
        txn.vehicle_reg,
        `"${txn.plaza_or_merchant.replace(/"/g, '""')}"`,
        txn.amount_inr,
        txn.settlement_status,
        `"${txn.timestamp}"`,
        txn.rrn,
        a?.classification ?? 'UNAUDITED',
        a ? `[${a.primary_citation}]` : '',
        a?.chargeback_code ?? '',
        `"${(a?.rationale ?? txn.notes).replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${CLIENT_PROFILE.batch_id}-audit.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderClassification = (classification: AuditClassification) => {
    switch (classification) {
      case 'COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>COMPLIANT</span>
          </span>
        );
      case 'DISPUTE_ELIGIBLE':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>DISPUTE_ELIGIBLE</span>
          </span>
        );
      case 'POLICY_VIOLATION':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>POLICY_VIOLATION</span>
          </span>
        );
      case 'HOLD_PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>HOLD_PENDING</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Heading & Entity Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Batch Reconciliation & Audit Grid
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="font-medium text-slate-700">{CLIENT_PROFILE.company_name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">GSTIN {CLIENT_PROFILE.gstin}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{CLIENT_PROFILE.batch_id}</span>
            <span aria-hidden="true">·</span>
            <span>{CLIENT_PROFILE.settlement_cycle}</span>
          </div>
        </div>

        {auditData && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              {auditData.model} · {(auditData.latency_ms / 1000).toFixed(2)}s
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* 4-Column Flat KPI Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Batch Gross Settlement</p>
          <p className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            ₹{metrics.grossTotal.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {transactions.length} fleet transactions · 7 POSTED / 1 PENDING
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Dispute Eligible (Chargeback)</p>
          <p className="text-xl font-semibold text-blue-700 font-mono tabular-nums mt-1">
            {auditData ? `₹${metrics.disputeAmount.toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {auditData
              ? `${metrics.disputeCount} record ready for NPCI filing`
              : 'Run RAG batch audit to classify'}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Policy Violations Flagged</p>
          <p className="text-xl font-semibold text-red-700 font-mono tabular-nums mt-1">
            {auditData ? `₹${metrics.violationAmount.toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {auditData
              ? `${metrics.violationCount} records breaching NETC / SLA rules`
              : 'Checks SH pass, Ex-08, corridor & GST'}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Hold Pending / Compliant</p>
          <p className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            {auditData
              ? `${metrics.holdCount} Hold · ${metrics.compliantCount} Clear`
              : 'Awaiting Audit'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {auditData
              ? `₹${metrics.holdAmount.toLocaleString('en-IN')} unsettled pre-arbitration hold`
              : 'Strict [DOC-XXX] citation on every row'}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {auditError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Batch Audit Failed</p>
              <p className="text-xs text-red-700 mt-0.5">{auditError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunAudit}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Retry Audit
          </button>
        </div>
      )}

      {/* Main Data Grid Surface */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Txn ID, VRN, plaza, or [DOC-XXX]..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#1E3A8A]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
            {FILTER_LABELS.map((tab) => {
              const active = classificationFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClassificationFilter(tab.id)}
                  disabled={!auditData && tab.id !== 'ALL'}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-45 disabled:cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 pl-4 pr-2 w-8" aria-label="Expand row details" />
                <th className="py-2.5 px-3 whitespace-nowrap">Txn ID & Time</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Vehicle Reg</th>
                <th className="py-2.5 px-3">Plaza / Merchant & Telemetry</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Settlement</th>
                <th className="py-2.5 px-3 whitespace-nowrap">RAG Audit Verdict</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Policy Citation</th>
                <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">Dispute Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs">
              {isAuditing
                ? transactions.map((txn) => (
                    <tr key={txn.txn_id} className="h-[60px]">
                      <td className="py-3 pl-4 pr-2">
                        <div className="w-3.5 h-3.5 bg-slate-100 rounded animate-pulse" />
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-semibold text-slate-900">{txn.txn_id}</div>
                        <div className="font-mono text-slate-400 tabular-nums mt-0.5">
                          {txn.timestamp}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {txn.vehicle_reg}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{txn.plaza_or_merchant}</div>
                        <div className="text-slate-500 mt-0.5">{txn.notes}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        ₹{txn.amount_inr.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">{txn.settlement_status}</td>
                      <td className="py-3 px-3">
                        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                      </td>
                      <td className="py-3 px-3">
                        <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <div className="h-6 w-32 bg-slate-100 rounded animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))
                : filteredTransactions.map((txn) => {
                    const audit = auditMap.get(txn.txn_id);
                    const isRowAuditing = auditingTxnIds.includes(txn.txn_id);
                    const isExpanded = expandedTxnId === txn.txn_id;
                    const isFlagged =
                      audit &&
                      (audit.classification === 'DISPUTE_ELIGIBLE' ||
                        audit.classification === 'POLICY_VIOLATION' ||
                        audit.classification === 'HOLD_PENDING');

                    return (
                      <Fragment key={txn.txn_id}>
                        <tr
                          className={`hover:bg-slate-50/90 transition-colors ${
                            isExpanded ? 'bg-slate-50/70' : ''
                          }`}
                        >
                          <td className="py-3 pl-4 pr-2 align-top">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTxnId(isExpanded ? null : txn.txn_id)
                              }
                              className="p-1 text-slate-400 hover:text-slate-800 rounded transition-colors"
                              aria-label={`Toggle audit trace for ${txn.txn_id}`}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-900">
                              {txn.txn_id}
                            </div>
                            <div className="font-mono text-slate-500 tabular-nums mt-0.5">
                              {txn.timestamp}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="font-mono font-medium text-slate-800">
                              {txn.vehicle_reg}
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              {txn.category === 'NETC_TOLL' ? 'NETC Toll' : 'Fleet Fuel'}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top min-w-[240px]">
                            <div className="font-medium text-slate-900">
                              {txn.plaza_or_merchant}
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              {txn.notes}
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono">RRN {txn.rrn}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            ₹{txn.amount_inr.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span
                              className={`font-mono font-medium ${
                                txn.settlement_status === 'PENDING'
                                  ? 'text-amber-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {txn.settlement_status}
                            </span>
                          </td>

                          <td className="py-3 px-3 align-top">
                            {isRowAuditing ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-[#1E3A8A] font-medium whitespace-nowrap">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Auditing row...</span>
                              </span>
                            ) : audit ? (
                              <div className="space-y-1">
                                {renderClassification(audit.classification)}
                                {audit.chargeback_code && audit.chargeback_code !== 'N/A' && (
                                  <div className="font-mono text-[11px] text-slate-500">
                                    Code: {audit.chargeback_code}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Not audited yet</span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            {isRowAuditing ? (
                              <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                            ) : audit ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {audit.cited_chunks.map((cid) => (
                                  <button
                                    key={cid}
                                    type="button"
                                    onClick={() => onInspectCitation(cid)}
                                    title={`Inspect policy ${cid}`}
                                    className="font-mono text-[11px] font-semibold px-1.5 py-0.5 bg-slate-50 border border-slate-300 text-slate-800 hover:border-[#1E3A8A] hover:text-[#1E3A8A] hover:bg-blue-50/40 rounded transition-colors whitespace-nowrap"
                                  >
                                    [{cid}]
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">—</span>
                            )}
                          </td>

                          <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                            {isRowAuditing ? (
                              <span className="text-slate-400">Running RAG...</span>
                            ) : audit && isFlagged ? (
                              <button
                                type="button"
                                onClick={() => onGenerateDisputePacket(txn, audit)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1E3A8A] bg-white border border-[#1E3A8A]/35 rounded-md hover:bg-[#1E3A8A] hover:text-white transition-colors whitespace-nowrap shrink-0"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Generate Dispute Packet</span>
                              </button>
                            ) : audit ? (
                              <span className="text-slate-400">No dispute needed</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRunSingleRowAudit(txn)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:border-[#1E3A8A] hover:text-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
                              >
                                <Play className="w-3 h-3" />
                                <span>Audit Row</span>
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Audit Reasoning & Retrieval Trace */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={9} className="px-6 py-4 border-t border-slate-200/80">
                              {audit ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                  <div className="lg:col-span-7 space-y-2">
                                    <p className="text-xs font-semibold text-slate-900">
                                      Gemini RAG Audit Rationale
                                    </p>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                      {audit.rationale}
                                    </p>
                                    <p className="text-xs text-slate-600 pt-1">
                                      <span className="font-semibold text-slate-800">
                                        Recommended Action:{' '}
                                      </span>
                                      {audit.recommended_action}
                                    </p>
                                  </div>

                                  <div className="lg:col-span-5 space-y-2">
                                    <p className="text-xs font-semibold text-slate-900">
                                      Top Retrieved Policy Chunks
                                    </p>
                                    <div className="space-y-1.5">
                                      {audit.retrieved_chunks.map((rc) => (
                                        <div
                                          key={rc.chunk_id}
                                          className="flex items-center justify-between gap-3 text-xs py-1 border-b border-slate-200/70 last:border-b-0"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => onInspectCitation(rc.chunk_id)}
                                            className="text-left text-slate-700 hover:text-[#1E3A8A] truncate"
                                          >
                                            <span className="font-mono font-semibold text-slate-900 mr-1.5">
                                              [{rc.chunk_id}]
                                            </span>
                                            <span>{rc.title}</span>
                                          </button>
                                          <span className="font-mono tabular-nums text-slate-600 shrink-0">
                                            {(rc.combined_score * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
                                  <span>
                                    Corridor: {txn.corridor_note} · RRN {txn.rrn}. Audit just{' '}
                                    <span className="font-mono font-semibold text-slate-900">
                                      {txn.txn_id}
                                    </span>{' '}
                                    against indexed NPCI / 1Pay policies.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onRunSingleRowAudit(txn)}
                                    disabled={isRowAuditing}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] disabled:opacity-55 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    {isRowAuditing ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Auditing {txn.txn_id}...</span>
                                      </>
                                    ) : (
                                      <span>Audit {txn.txn_id} Only</span>
                                    )}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

              {!isAuditing && filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-500">
                    No fleet transactions match the current search or classification filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Unaudited Callout Footer */}
        {!auditData && !isAuditing && (
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-900">Ready for RAG Compliance Audit:</span>{' '}
              Run Gemini retrieval against all indexed NPCI NETC circulars and 1Pay Fleet SLA rules
              to classify all 8 batch rows with exact policy citations.
            </div>
            <button
              type="button"
              onClick={onRunAudit}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              Run AI RAG Batch Audit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

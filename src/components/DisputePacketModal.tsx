import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  FileCheck2,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { CLIENT_PROFILE } from '../data/knowledgeBase';
import type { DisputePacket, FleetTransaction, RowAuditResult } from '../types/compliance';

interface DisputePacketModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  transaction: FleetTransaction | null;
  relatedTransaction: FleetTransaction | null;
  auditResult: RowAuditResult | null;
  packet: DisputePacket | null;
  onClose: () => void;
  onRetry: () => void;
  onInspectCitation: (chunkId: string) => void;
}

function buildPlainTextMemo(
  packet: DisputePacket,
  txn: FleetTransaction,
  relatedTxn: FleetTransaction | null
): string {
  const lines = [
    '========================================================================',
    '1PAY ENTERPRISE — FORMAL NPCI NETC / B2B SLA DISPUTE & COMPLIANCE MEMO',
    '========================================================================',
    `Memo Reference:      ${packet.memo_id}`,
    `Generated (UTC):     ${new Date(packet.generated_at).toISOString()}`,
    `Client Entity:       ${CLIENT_PROFILE.company_name} (${CLIENT_PROFILE.client_id})`,
    `Client GSTIN:        ${CLIENT_PROFILE.gstin}`,
    `Filing Authority:    ${packet.filing_authority}`,
    `Eligibility Status:  ${packet.eligibility_status}`,
    `Reason/Action Code:  ${packet.chargeback_code}`,
    `SLA Resolution TAT:  ${packet.sla_timeline}`,
    '',
    `SUBJECT: ${packet.subject_line}`,
    '',
    '1. TRANSACTION RECORD SUMMARY',
    `   - Primary Txn ID:   ${txn.txn_id}`,
    `   - Vehicle Reg:      ${txn.vehicle_reg}`,
    `   - Plaza / Merchant: ${txn.plaza_or_merchant}`,
    `   - Amount:           INR ${txn.amount_inr.toLocaleString('en-IN')}`,
    `   - Settlement State: ${txn.settlement_status}`,
    `   - Timestamp:        ${txn.timestamp}`,
    `   - RRN:              ${txn.rrn}`,
    `   - Notes:            ${txn.notes}`,
  ];

  if (relatedTxn) {
    lines.push(
      `   - Counterpart Txn:  ${relatedTxn.txn_id} | RRN ${relatedTxn.rrn} | ${relatedTxn.timestamp} | INR ${relatedTxn.amount_inr}`
    );
  }

  lines.push(
    '',
    '2. EXECUTIVE SUMMARY',
    packet.executive_summary,
    '',
    '3. GOVERNING POLICY CITATIONS',
    ...packet.policy_citations.map(
      (c) => `   - [${c.chunk_id} | ${c.source_doc}]: ${c.clause_application}`
    ),
    '',
    '4. FORMAL CLAIM / COMPLIANCE NARRATIVE',
    packet.formal_narrative,
    '',
    '5. REQUIRED SUPPORTING ANNEXURES',
    ...packet.required_annexures.map((a, i) => `   ${i + 1}. ${a}`),
    '',
    '6. ESCALATION & RESOLUTION LADDER',
    ...packet.escalation_steps.map((s, i) => `   ${i + 1}. ${s}`),
    '========================================================================'
  );

  return lines.join('\n');
}

export function DisputePacketModal({
  isOpen,
  isLoading,
  error,
  transaction,
  relatedTransaction,
  auditResult,
  packet,
  onClose,
  onRetry,
  onInspectCitation,
}: DisputePacketModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !transaction) return null;

  const handleCopy = async () => {
    if (!packet) return;
    const text = buildPlainTextMemo(packet, transaction, relatedTransaction);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!packet) return;
    const text = buildPlainTextMemo(packet, transaction, relatedTransaction);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packet.memo_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderEligibilityMeta = (status: DisputePacket['eligibility_status']) => {
    if (status === 'ELIGIBLE_FOR_FILING') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Eligible for Acquirer Filing</span>
        </span>
      );
    }
    if (status === 'BLOCKED_HOLD_REQUIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Clock className="w-3.5 h-3.5" />
          <span>Hold Required — Blocked from Filing</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Regularization / Admin Sign-Off Required</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-packet-heading"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <span className="font-mono font-semibold text-slate-900">{transaction.txn_id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{transaction.vehicle_reg}</span>
              {auditResult && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-700">[{auditResult.primary_citation}]</span>
                </>
              )}
            </div>
            <h2 id="dispute-packet-heading" className="text-base font-semibold text-slate-900">
              NPCI NETC / 1Pay SLA Dispute & Compliance Packet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors"
            aria-label="Close dispute packet modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-6 h-6 text-[#1E3A8A] animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Drafting Formal B2B Dispute Packet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Grounding claim clauses, chargeback reason codes, and Level 1/2 TAT matrices via Gemini.
                </p>
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-5 bg-red-50 border border-red-200 rounded-md space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">
                  <p className="font-semibold">Unable to generate dispute packet</p>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors"
              >
                Retry Packet Generation
              </button>
            </div>
          )}

          {!isLoading && !error && packet && (
            <div className="space-y-6 text-sm text-slate-800">
              {/* Memo Header Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pb-5 border-b border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Memo Reference ID</p>
                  <p className="font-mono text-xs font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {packet.memo_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Filing Eligibility Verdict</p>
                  <div className="mt-0.5">{renderEligibilityMeta(packet.eligibility_status)}</div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Filing Authority / Desk</p>
                  <p className="text-xs font-medium text-slate-900 mt-0.5">
                    {packet.filing_authority}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Chargeback / Action Code</p>
                  <p className="font-mono text-xs font-semibold text-slate-900 mt-0.5">
                    {packet.chargeback_code}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">SLA Resolution TAT (per DOC-105)</p>
                  <p className="text-xs font-medium text-slate-900 mt-0.5">{packet.sla_timeline}</p>
                </div>
              </div>

              {/* Subject & Executive Summary */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">Subject Line</p>
                <p className="text-sm font-semibold text-slate-900 leading-snug">
                  {packet.subject_line}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed pt-1">
                  {packet.executive_summary}
                </p>
              </div>

              {/* Transaction Telemetry Snapshot */}
              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-xs font-semibold text-slate-900 mb-3">
                  Settlement Record Evidence
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Txn ID</th>
                        <th className="px-3 py-2 font-medium">RRN</th>
                        <th className="px-3 py-2 font-medium">Timestamp</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-900">Flagged Entry</td>
                        <td className="px-3 py-2 font-mono">{transaction.txn_id}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{transaction.rrn}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{transaction.timestamp}</td>
                        <td className="px-3 py-2 font-mono">{transaction.settlement_status}</td>
                        <td className="px-3 py-2 font-mono text-right tabular-nums font-medium">
                          ₹{transaction.amount_inr.toLocaleString('en-IN')}
                        </td>
                      </tr>
                      {relatedTransaction && (
                        <tr className="bg-slate-50/60">
                          <td className="px-3 py-2 text-slate-600">Original Pair</td>
                          <td className="px-3 py-2 font-mono">{relatedTransaction.txn_id}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {relatedTransaction.rrn}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {relatedTransaction.timestamp}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {relatedTransaction.settlement_status}
                          </td>
                          <td className="px-3 py-2 font-mono text-right tabular-nums">
                            ₹{relatedTransaction.amount_inr.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Governing Citations */}
              <div className="border-t border-slate-200 pt-5 space-y-3">
                <h3 className="text-xs font-semibold text-slate-900">
                  Cited Regulatory & SLA Clauses
                </h3>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {packet.policy_citations.map((citation) => (
                    <div
                      key={`${citation.chunk_id}-${citation.source_doc}`}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectCitation(citation.chunk_id)}
                        className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-50 border border-slate-300 text-slate-900 hover:border-[#1E3A8A] hover:text-[#1E3A8A] rounded self-start whitespace-nowrap shrink-0 transition-colors"
                      >
                        [{citation.chunk_id}]
                      </button>
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium text-slate-900">{citation.source_doc}</p>
                        <p className="text-slate-600 mt-0.5">{citation.clause_application}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formal Narrative */}
              <div className="border-t border-slate-200 pt-5 space-y-2">
                <h3 className="text-xs font-semibold text-slate-900">
                  Formal Claim & Compliance Statement
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {packet.formal_narrative}
                </p>
              </div>

              {/* Annexures & Escalation Steps */}
              <div className="border-t border-slate-200 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 mb-2.5">
                    Required Supporting Annexures
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                    {packet.required_annexures.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 mb-2.5">
                    Action & Escalation Ladder
                  </h3>
                  <ol className="space-y-1.5 text-xs text-slate-700 list-decimal pl-4">
                    {packet.escalation_steps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {packet ? `Drafted in ${packet.latency_ms} ms` : 'NPCI / 1Pay Standard Template'}
          </div>
          <div className="flex items-center gap-2.5">
            {packet && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Memo</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Packet (.txt)</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

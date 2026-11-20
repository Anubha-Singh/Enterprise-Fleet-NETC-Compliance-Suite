/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  Loader2,
  Menu,
  Play,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BatchReconciliationTab } from './components/BatchReconciliationTab';
import { DisputePacketModal } from './components/DisputePacketModal';
import { KnowledgeSandboxTab } from './components/KnowledgeSandboxTab';
import { PolicyInspectorDrawer } from './components/PolicyInspectorDrawer';
import { RagEvalsTab } from './components/RagEvalsTab';
import {
  CLIENT_PROFILE,
  INITIAL_POLICY_CHUNKS,
  MOCK_FLEET_TRANSACTIONS,
} from './data/knowledgeBase';
import type {
  BatchAuditResponse,
  DisputePacket,
  EvalSuiteResponse,
  FleetTransaction,
  PolicyChunk,
  RagQueryResponse,
  RowAuditResult,
} from './types/compliance';
import {
  generateDisputePacketApi,
  runBatchAuditApi,
  runEvalSuiteApi,
  runRagQueryApi,
} from './utils/api';

type ActiveTab = 'batch' | 'sandbox' | 'evals';

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  breadcrumb: string;
  icon: typeof ClipboardCheck;
}> = [
  {
    id: 'batch',
    label: 'Batch Reconciliation',
    breadcrumb: 'Batch Reconciliation & Audit Grid',
    icon: ClipboardCheck,
  },
  {
    id: 'sandbox',
    label: 'Knowledge & Retrieval',
    breadcrumb: 'RAG Knowledge Base & Sandbox',
    icon: BookOpen,
  },
  {
    id: 'evals',
    label: 'RAG Evals & Traces',
    breadcrumb: 'RAG Evals & Citation Accuracy',
    icon: ShieldCheck,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('batch');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Knowledge Base state (6 embedded NPCI/1Pay rules + user-added rules)
  const [policyChunks, setPolicyChunks] = useState<PolicyChunk[]>(INITIAL_POLICY_CHUNKS);
  const [inspectedChunk, setInspectedChunk] = useState<PolicyChunk | null>(null);

  // Tab 1: Batch Audit state
  const [auditData, setAuditData] = useState<BatchAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Dispute Packet modal state
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTxn, setDisputeTxn] = useState<FleetTransaction | null>(null);
  const [disputeRelatedTxn, setDisputeRelatedTxn] = useState<FleetTransaction | null>(null);
  const [disputeAudit, setDisputeAudit] = useState<RowAuditResult | null>(null);
  const [disputePacket, setDisputePacket] = useState<DisputePacket | null>(null);
  const [isDraftingPacket, setIsDraftingPacket] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);

  // Tab 2: Retrieval Sandbox state
  const [queryInput, setQueryInput] = useState('');
  const [sandboxResult, setSandboxResult] = useState<RagQueryResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);

  // Tab 3: RAG Evals state
  const [evalSuite, setEvalSuite] = useState<EvalSuiteResponse | null>(null);
  const [isRunningEvals, setIsRunningEvals] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const handleInspectCitation = (chunkId: string) => {
    const cleanId = chunkId.replace(/[\[\]]/g, '').trim();
    const found = policyChunks.find((c) => c.chunk_id === cleanId);
    if (found) {
      setInspectedChunk(found);
    }
  };

  const handleRunBatchAudit = async () => {
    setIsAuditing(true);
    setAuditError(null);
    try {
      const response = await runBatchAuditApi({
        transactions: MOCK_FLEET_TRANSACTIONS,
        chunks: policyChunks,
        batch_id: CLIENT_PROFILE.batch_id,
        client_name: CLIENT_PROFILE.company_name,
      });
      setAuditData(response);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Batch audit request failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleGenerateDisputePacket = async (
    txn: FleetTransaction,
    auditResult: RowAuditResult
  ) => {
    const sibling =
      MOCK_FLEET_TRANSACTIONS.find(
        (other) =>
          other.txn_id !== txn.txn_id &&
          other.vehicle_reg === txn.vehicle_reg &&
          other.plaza_or_merchant === txn.plaza_or_merchant
      ) ?? null;

    setDisputeTxn(txn);
    setDisputeRelatedTxn(sibling);
    setDisputeAudit(auditResult);
    setDisputePacket(null);
    setPacketError(null);
    setDisputeModalOpen(true);
    setIsDraftingPacket(true);

    try {
      const packet = await generateDisputePacketApi({
        transaction: txn,
        auditResult,
        relatedTransaction: sibling,
        chunks: policyChunks,
        client_name: CLIENT_PROFILE.company_name,
      });
      setDisputePacket(packet);
    } catch (err) {
      setPacketError(
        err instanceof Error ? err.message : 'Unable to draft dispute packet.'
      );
    } finally {
      setIsDraftingPacket(false);
    }
  };

  const handleRetryDisputePacket = () => {
    if (disputeTxn && disputeAudit) {
      handleGenerateDisputePacket(disputeTxn, disputeAudit);
    }
  };

  const handleRunRagQuery = async (overrideQuery?: string) => {
    const targetQuery = (overrideQuery ?? queryInput).trim();
    if (!targetQuery) return;
    setIsQuerying(true);
    setQueryError(null);
    try {
      const result = await runRagQueryApi({
        query: targetQuery,
        chunks: policyChunks,
      });
      setSandboxResult(result);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'RAG retrieval query failed.');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleAddPolicyRule = (
    rule: Omit<PolicyChunk, 'chunk_id' | 'effective_date' | 'isCustom'>
  ) => {
    const maxNum = policyChunks.reduce((max, c) => {
      const n = Number(c.chunk_id.replace('DOC-', ''));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 106);

    const newChunk: PolicyChunk = {
      chunk_id: `DOC-${maxNum + 1}`,
      source_doc: rule.source_doc,
      section: rule.section,
      title: rule.title,
      content: rule.content,
      effective_date: new Date().toISOString().slice(0, 10),
      isCustom: true,
    };
    setPolicyChunks((prev) => [...prev, newChunk]);
  };

  const handleDeleteCustomRule = (chunkId: string) => {
    setPolicyChunks((prev) => prev.filter((c) => c.chunk_id !== chunkId));
  };

  const handleTestChunkInSandbox = (chunk: PolicyChunk) => {
    const prompt = `What are the exact compliance requirements and dispute rules under ${chunk.title} (${chunk.source_doc} ${chunk.section})?`;
    setActiveTab('sandbox');
    setQueryInput(prompt);
    handleRunRagQuery(prompt);
  };

  const handleRunEvalSuite = async () => {
    setIsRunningEvals(true);
    setEvalError(null);
    try {
      const result = await runEvalSuiteApi({ chunks: policyChunks });
      setEvalSuite(result);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Eval suite execution failed.');
    } finally {
      setIsRunningEvals(false);
    }
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  const renderHeaderPrimaryAction = () => {
    if (activeTab === 'batch') {
      return (
        <button
          type="button"
          onClick={handleRunBatchAudit}
          disabled={isAuditing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] disabled:opacity-55 transition-colors whitespace-nowrap shrink-0"
        >
          {isAuditing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Auditing 8 Records...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Run AI RAG Batch Audit</span>
            </>
          )}
        </button>
      );
    }

    if (activeTab === 'sandbox') {
      return (
        <button
          type="button"
          onClick={() => setIsAddRuleOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Policy Rule</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleRunEvalSuite}
        disabled={isRunningEvals}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] disabled:opacity-55 transition-colors whitespace-nowrap shrink-0"
      >
        {isRunningEvals ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Running Eval Suite...</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            <span>Run 5-Case Eval Suite</span>
          </>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white border-r border-slate-200">
      <div>
        {/* Brand Wordmark */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            1Pay Enterprise
          </span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Client Entity Context */}
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Active Fleet Entity</p>
          <p className="text-xs font-semibold text-slate-900 mt-0.5 leading-snug">
            {CLIENT_PROFILE.company_name}
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            {CLIENT_PROFILE.client_id} · {CLIENT_PROFILE.fleet_size} Tags
          </p>
        </div>

        {/* Primary Navigation */}
        <nav className="p-3 space-y-1" aria-label="Workspace Modules">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left whitespace-nowrap ${
                  active
                    ? 'bg-[#EFF6FF] text-[#1E3A8A]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quiet Workspace Summary Footer */}
      <div className="px-5 py-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
        <p className="font-medium text-slate-700">NETC & SLA Compliance Suite</p>
        <p className="font-mono tabular-nums">
          {policyChunks.length} Indexed Clauses · {MOCK_FLEET_TRANSACTIONS.length} Batch Rows
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex bg-slate-950/40"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb Left + Single Primary CTA Right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-slate-500 truncate"
            >
              <span className="hidden sm:inline whitespace-nowrap">1Pay Enterprise</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="hidden md:inline whitespace-nowrap">Apex Freight Carriers</span>
              <span className="hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">
                {currentNav.breadcrumb}
              </span>
            </nav>
          </div>

          <div className="flex items-center shrink-0">{renderHeaderPrimaryAction()}</div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'batch' && (
            <BatchReconciliationTab
              transactions={MOCK_FLEET_TRANSACTIONS}
              auditData={auditData}
              isAuditing={isAuditing}
              auditError={auditError}
              onRunAudit={handleRunBatchAudit}
              onInspectCitation={handleInspectCitation}
              onGenerateDisputePacket={handleGenerateDisputePacket}
            />
          )}

          {activeTab === 'sandbox' && (
            <KnowledgeSandboxTab
              chunks={policyChunks}
              queryInput={queryInput}
              onQueryInputChange={setQueryInput}
              sandboxResult={sandboxResult}
              isQuerying={isQuerying}
              queryError={queryError}
              isAddRuleOpen={isAddRuleOpen}
              onToggleAddRule={setIsAddRuleOpen}
              onAddPolicyRule={handleAddPolicyRule}
              onDeleteCustomRule={handleDeleteCustomRule}
              onRunRagQuery={handleRunRagQuery}
              onInspectCitation={handleInspectCitation}
            />
          )}

          {activeTab === 'evals' && (
            <RagEvalsTab
              evalSuite={evalSuite}
              isRunningEvals={isRunningEvals}
              evalError={evalError}
              onRunEvals={handleRunEvalSuite}
              onInspectCitation={handleInspectCitation}
            />
          )}
        </main>
      </div>

      {/* Policy Citation Inspector Drawer */}
      <PolicyInspectorDrawer
        chunk={inspectedChunk}
        onClose={() => setInspectedChunk(null)}
        onTestInSandbox={handleTestChunkInSandbox}
      />

      {/* Formal NPCI / 1Pay SLA Dispute Packet Modal */}
      <DisputePacketModal
        isOpen={disputeModalOpen}
        isLoading={isDraftingPacket}
        error={packetError}
        transaction={disputeTxn}
        relatedTransaction={disputeRelatedTxn}
        auditResult={disputeAudit}
        packet={disputePacket}
        onClose={() => setDisputeModalOpen(false)}
        onRetry={handleRetryDisputePacket}
        onInspectCitation={handleInspectCitation}
      />
    </div>
  );
}

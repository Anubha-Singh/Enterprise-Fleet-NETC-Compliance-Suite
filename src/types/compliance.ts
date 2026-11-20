export interface PolicyChunk {
  chunk_id: string;
  source_doc: string;
  section: string;
  title: string;
  content: string;
  effective_date: string;
  isCustom?: boolean;
}

export type SettlementStatus = 'POSTED' | 'PENDING';

export type TransactionCategory = 'NETC_TOLL' | 'FLEET_FUEL';

export interface FleetTransaction {
  txn_id: string;
  vehicle_reg: string;
  plaza_or_merchant: string;
  category: TransactionCategory;
  amount_inr: number;
  settlement_status: SettlementStatus;
  timestamp: string;
  rrn: string;
  corridor_note: string;
  notes: string;
}

export type AuditClassification =
  | 'COMPLIANT'
  | 'DISPUTE_ELIGIBLE'
  | 'POLICY_VIOLATION'
  | 'HOLD_PENDING';

export interface RetrievedChunkScore {
  chunk_id: string;
  source_doc: string;
  section: string;
  title: string;
  content: string;
  semantic_score: number;
  lexical_score: number;
  combined_score: number;
}

export interface RowAuditResult {
  txn_id: string;
  classification: AuditClassification;
  primary_citation: string;
  cited_chunks: string[];
  chargeback_code: string;
  rationale: string;
  recommended_action: string;
  dispute_actionable: boolean;
  retrieved_chunks: RetrievedChunkScore[];
}

export interface BatchAuditResponse {
  batch_id: string;
  client_name: string;
  model: string;
  latency_ms: number;
  audited_at: string;
  results: RowAuditResult[];
}

export interface DisputePacket {
  memo_id: string;
  generated_at: string;
  txn_id: string;
  vehicle_reg: string;
  filing_authority: string;
  chargeback_code: string;
  eligibility_status: 'ELIGIBLE_FOR_FILING' | 'BLOCKED_HOLD_REQUIRED' | 'REGULARIZATION_REQUIRED';
  sla_timeline: string;
  subject_line: string;
  executive_summary: string;
  policy_citations: Array<{
    chunk_id: string;
    source_doc: string;
    clause_application: string;
  }>;
  formal_narrative: string;
  required_annexures: string[];
  escalation_steps: string[];
  latency_ms: number;
}

export interface RagQueryResponse {
  query: string;
  grounded: boolean;
  answer: string;
  cited_chunk_ids: string[];
  confidence_note: string;
  retrieved_chunks: RetrievedChunkScore[];
  latency_ms: number;
  model: string;
}

export interface EvalCaseTrace {
  eval_id: string;
  name: string;
  category: 'RETRIEVAL_RECALL' | 'HALLUCINATION_GUARDRAIL';
  query: string;
  expected_chunk_id: string | null;
  expected_grounded: boolean;
  actual_grounded: boolean;
  retrieved_chunks: RetrievedChunkScore[];
  cited_chunk_ids: string[];
  inline_citations_found: string[];
  fabricated_citations: string[];
  answer: string;
  retrieval_recall_pass: boolean;
  citation_faithfulness_pass: boolean;
  overall_pass: boolean;
  failure_reason: string | null;
  latency_ms: number;
}

export interface EvalSuiteResponse {
  run_id: string;
  executed_at: string;
  model: string;
  embedding_model: string;
  total_cases: number;
  passed_cases: number;
  pass_rate_pct: number;
  retrieval_recall_pct: number;
  citation_faithfulness_pct: number;
  avg_latency_ms: number;
  cases: EvalCaseTrace[];
}

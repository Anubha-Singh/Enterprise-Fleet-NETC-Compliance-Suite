import type {
  BatchAuditResponse,
  DisputePacket,
  EvalSuiteResponse,
  FleetTransaction,
  PolicyChunk,
  RagQueryResponse,
  RowAuditResult,
} from '../types/compliance';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function runBatchAuditApi(payload: {
  transactions: FleetTransaction[];
  chunks: PolicyChunk[];
  batch_id: string;
  client_name: string;
}): Promise<BatchAuditResponse> {
  return postJson<BatchAuditResponse>('/api/audit-batch', payload);
}

export function runSingleRowAuditApi(payload: {
  transaction: FleetTransaction;
  allTransactions: FleetTransaction[];
  chunks: PolicyChunk[];
  client_name: string;
}): Promise<{
  result: RowAuditResult;
  model: string;
  latency_ms: number;
  audited_at: string;
}> {
  return postJson('/api/audit-row', payload);
}

export function generateDisputePacketApi(payload: {
  transaction: FleetTransaction;
  auditResult: RowAuditResult;
  relatedTransaction?: FleetTransaction | null;
  chunks: PolicyChunk[];
  client_name: string;
}): Promise<DisputePacket> {
  return postJson<DisputePacket>('/api/dispute-packet', payload);
}

export function runRagQueryApi(payload: {
  query: string;
  chunks: PolicyChunk[];
}): Promise<RagQueryResponse> {
  return postJson<RagQueryResponse>('/api/rag-query', payload);
}

export function runEvalSuiteApi(payload: {
  chunks: PolicyChunk[];
}): Promise<EvalSuiteResponse> {
  return postJson<EvalSuiteResponse>('/api/run-evals', payload);
}

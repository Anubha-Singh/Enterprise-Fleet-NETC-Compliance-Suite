import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  BatchAuditResponse,
  DisputePacket,
  EvalCaseTrace,
  EvalSuiteResponse,
  FleetTransaction,
  PolicyChunk,
  RagQueryResponse,
  RetrievedChunkScore,
  RowAuditResult,
} from '../src/types/compliance';

const TEXT_MODEL = 'gemini-4-hydrogen';
const EMBEDDING_MODEL = 'gemini-embedding-2';

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY in your environment variables (Settings > Secrets or Vercel Environment Variables).'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Cache embeddings per chunk content hash to keep retrieval fast and consistent
const embeddingCache = new Map<string, number[]>();

function chunkCacheKey(chunk: PolicyChunk): string {
  return `${chunk.chunk_id}::${chunk.source_doc}::${chunk.section}::${chunk.content}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'of', 'on', 'in', 'to', 'for', 'and', 'or', 'a', 'an', 'be',
  'by', 'with', 'are', 'can', 'we', 'what', 'how', 'does', 'do', 'if', 'it', 'that',
  'this', 'as', 'from', 'within', 'must', 'via', 'not', 'only', 'once', 'before',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function computeLexicalScore(query: string, chunk: PolicyChunk): number {
  const queryLower = query.toLowerCase();
  const docText = `${chunk.chunk_id} ${chunk.source_doc} ${chunk.section} ${chunk.title} ${chunk.content}`.toLowerCase();
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return 0;

  const docTokenSet = new Set(tokenize(docText));
  let matched = 0;
  for (const token of queryTokens) {
    if (docTokenSet.has(token)) {
      matched += 1;
    } else if (token.length >= 4 && docText.includes(token)) {
      matched += 0.7;
    }
  }

  const baseOverlap = matched / Math.max(queryTokens.length, 1);

  const domainBoosts: Array<{ pattern: RegExp; chunkPattern: RegExp; bonus: number }> = [
    { pattern: /duplicate|twice|3 mins|10 min|netc-dup-01|distinct rrn/i, chunkPattern: /duplicate|netc-dup-01|10 minutes/i, bonus: 0.35 },
    { pattern: /annual pass|state highway|\bsh-\d+\b|sh\b|private expressway|municipal/i, chunkPattern: /annual pass|state highways/i, bonus: 0.35 },
    { pattern: /exception code 08|code 08|blacklist|e-notice|2x|kyc/i, chunkPattern: /exception code 08|blacklist|2x/i, bonus: 0.35 },
    { pattern: /fuel|pump|hpcl|iocl|gst|gstin|corridor|off-route|25 km|5,000|5000/i, chunkPattern: /fuel card|gstin|25 km|corridor/i, bonus: 0.35 },
    { pattern: /tat|nodal|escalation|working days|business days|grievance|level 1|level 2/i, chunkPattern: /nodal|escalation|3–5 working days|level 1/i, bonus: 0.35 },
    { pattern: /pending|unsettled|transient|pre-arbitration|posted/i, chunkPattern: /pending|transient|pre-arbitration|posted/i, bonus: 0.35 },
  ];

  let bonus = 0;
  for (const rule of domainBoosts) {
    if (rule.pattern.test(queryLower) && rule.chunkPattern.test(docText)) {
      bonus += rule.bonus;
    }
  }

  return Math.min(1, baseOverlap * 0.8 + bonus);
}

async function embedTexts(ai: GoogleGenAI, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
  });
  const embeddings = response.embeddings ?? [];
  return embeddings.map((item) => item.values ?? []);
}

async function retrieveRankedChunks(
  ai: GoogleGenAI,
  query: string,
  chunks: PolicyChunk[]
): Promise<RetrievedChunkScore[]> {
  const missingChunks = chunks.filter((chunk) => !embeddingCache.has(chunkCacheKey(chunk)));
  const textsToEmbed: string[] = [
    query,
    ...missingChunks.map((c) => `[${c.chunk_id} | ${c.source_doc} ${c.section}] ${c.title}: ${c.content}`),
  ];

  const vectors = await embedTexts(ai, textsToEmbed);
  const queryVector = vectors[0] ?? [];

  missingChunks.forEach((chunk, idx) => {
    const vec = vectors[idx + 1];
    if (vec && vec.length > 0) {
      embeddingCache.set(chunkCacheKey(chunk), vec);
    }
  });

  const scored: RetrievedChunkScore[] = chunks.map((chunk) => {
    const chunkVec = embeddingCache.get(chunkCacheKey(chunk)) ?? [];
    const rawCosine = cosineSimilarity(queryVector, chunkVec);
    const semanticScore = Math.max(0, Math.min(1, (rawCosine - 0.32) / 0.55));
    const lexicalScore = computeLexicalScore(query, chunk);
    const combinedScore = Math.max(
      0,
      Math.min(1, semanticScore * 0.62 + lexicalScore * 0.38)
    );

    return {
      chunk_id: chunk.chunk_id,
      source_doc: chunk.source_doc,
      section: chunk.section,
      title: chunk.title,
      content: chunk.content,
      semantic_score: Number(semanticScore.toFixed(4)),
      lexical_score: Number(lexicalScore.toFixed(4)),
      combined_score: Number(combinedScore.toFixed(4)),
    };
  });

  return scored.sort((a, b) => b.combined_score - a.combined_score);
}

function buildTransactionRetrievalQuery(
  txn: FleetTransaction,
  allTransactions: FleetTransaction[]
): string {
  const siblings = allTransactions.filter(
    (other) =>
      other.txn_id !== txn.txn_id &&
      other.vehicle_reg === txn.vehicle_reg &&
      other.plaza_or_merchant === txn.plaza_or_merchant
  );
  const dupSignal =
    siblings.length > 0
      ? `Potential duplicate RFID toll debit for vehicle ${txn.vehicle_reg} at ${txn.plaza_or_merchant} with distinct RRNs (${txn.rrn} vs ${siblings.map((s) => s.rrn).join(', ')})`
      : '';

  return [
    `Transaction ${txn.txn_id} category ${txn.category}`,
    `Merchant/Plaza: ${txn.plaza_or_merchant}`,
    `Amount: ₹${txn.amount_inr}`,
    `Settlement status: ${txn.settlement_status}`,
    `Corridor: ${txn.corridor_note}`,
    `Notes: ${txn.notes}`,
    dupSignal,
  ]
    .filter(Boolean)
    .join('. ');
}

function extractInlineCitations(text: string): string[] {
  const matches = text.match(/\[DOC-\d+\]/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace(/[\[\]]/g, ''))));
}

async function runSingleRagQuery(
  ai: GoogleGenAI,
  query: string,
  chunks: PolicyChunk[]
): Promise<RagQueryResponse> {
  const start = Date.now();
  const rankedChunks = await retrieveRankedChunks(ai, query, chunks);
  const topContext = rankedChunks.slice(0, 4);

  const kbContextBlock = topContext
    .map(
      (c) =>
        `[${c.chunk_id} | ${c.source_doc} ${c.section}] (Relevance: ${(c.combined_score * 100).toFixed(1)}%)\n${c.content}`
    )
    .join('\n\n');

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: `Policy Compliance Question:\n${query}\n\nRetrieved Policy Chunks:\n${kbContextBlock}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are a strict NPCI NETC & 1Pay Enterprise B2B Fleet Compliance RAG Engine.
CRITICAL GROUNDING RULES:
1. Answer ONLY using facts explicitly stated in the provided Retrieved Policy Chunks.
2. NEVER invent, assume, or extrapolate rules, monetary caps, timelines, or policy clauses not explicitly written in the chunks.
3. If the question asks about a topic, policy, fee, customs rule, or workflow that is NOT covered by the retrieved chunks, you MUST set "grounded" to false, set "cited_chunk_ids" to an empty array [], and write a concise refusal stating that the indexed NPCI NETC & 1Pay Knowledge Base does not contain a governing policy for this query (do NOT include any [DOC-XXX] tags in a refusal).
4. When "grounded" is true, every factual statement MUST cite its source inline in exact bracket format such as [DOC-101], [DOC-102], etc., and list those exact IDs in "cited_chunk_ids".
5. Keep answers crisp, authoritative, and formatted for B2B finance/operations officers.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grounded: {
            type: Type.BOOLEAN,
            description:
              'True only if the retrieved chunks explicitly answer the question; false if out-of-scope or missing from the knowledge base.',
          },
          answer: {
            type: Type.STRING,
            description:
              'Strictly cited compliance answer with inline [DOC-XXX] references, or a clear refusal with zero citations if ungrounded.',
          },
          cited_chunk_ids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Exact chunk_ids cited in the answer (e.g., ["DOC-102"]). Empty array if grounded is false.',
          },
          confidence_note: {
            type: Type.STRING,
            description:
              'One concise sentence summarizing grounding verification and chunk coverage.',
          },
        },
        required: ['grounded', 'answer', 'cited_chunk_ids', 'confidence_note'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    grounded: boolean;
    answer: string;
    cited_chunk_ids: string[];
    confidence_note: string;
  };

  return {
    query,
    grounded: Boolean(parsed.grounded),
    answer: parsed.answer ?? 'Unable to generate response.',
    cited_chunk_ids: Array.isArray(parsed.cited_chunk_ids) ? parsed.cited_chunk_ids : [],
    confidence_note: parsed.confidence_note ?? '',
    retrieved_chunks: rankedChunks,
    latency_ms: Date.now() - start,
    model: TEXT_MODEL,
  };
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
    return {
      status: 403,
      message:
        'Gemini API authentication failed. Please check your GEMINI_API_KEY in Settings > Secrets or Vercel Environment Variables.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached (429). Please retry shortly or verify your billing-enabled API key.',
    };
  }
  return {
    status: 500,
    message: raw || 'Unexpected error communicating with Gemini API.',
  };
}

const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '1pay-enterprise-rag-api',
    gemini_configured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// POST /api/audit-batch — Runs RAG retrieval + Gemini structured audit across all 8 rows
apiRouter.post('/audit-batch', async (req, res) => {
  const start = Date.now();
  try {
    const { transactions, chunks, batch_id, client_name } = req.body as {
      transactions: FleetTransaction[];
      chunks: PolicyChunk[];
      batch_id?: string;
      client_name?: string;
    };

    if (!Array.isArray(transactions) || !Array.isArray(chunks)) {
      res.status(400).json({ error: 'transactions and chunks arrays are required.' });
      return;
    }

    const ai = getGenAIClient();

    const perRowRetrievals = await Promise.all(
      transactions.map(async (txn) => {
        const query = buildTransactionRetrievalQuery(txn, transactions);
        const ranked = await retrieveRankedChunks(ai, query, chunks);
        return { txn_id: txn.txn_id, ranked };
      })
    );

    const retrievalMap = new Map<string, RetrievedChunkScore[]>(
      perRowRetrievals.map((entry) => [entry.txn_id, entry.ranked])
    );

    const kbBlock = chunks
      .map((c) => `[${c.chunk_id} | ${c.source_doc} ${c.section}] ${c.title}: ${c.content}`)
      .join('\n');

    const rowsBlock = transactions
      .map((txn) => {
        const topMatches = (retrievalMap.get(txn.txn_id) ?? [])
          .slice(0, 3)
          .map((m) => `${m.chunk_id} (${(m.combined_score * 100).toFixed(0)}%)`)
          .join(', ');
        return `${txn.txn_id} | Vehicle: ${txn.vehicle_reg} | Plaza/Merchant: ${txn.plaza_or_merchant} | Category: ${txn.category} | Amount: ₹${txn.amount_inr} | Status: ${txn.settlement_status} | Time: ${txn.timestamp} | RRN: ${txn.rrn} | Corridor: ${txn.corridor_note} | Notes: ${txn.notes} | Top Retrieved Policies: [${topMatches}]`;
      })
      .join('\n');

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Embedded Knowledge Base:\n${kbBlock}\n\nB2B Settlement Batch for ${client_name ?? 'Apex Freight Carriers Pvt Ltd'}:\n${rowsBlock}\n\nAudit EVERY row and return exact structured classifications.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are the 1Pay Enterprise Fleet Reconciliation & NPCI NETC Compliance Auditor.
Audit every transaction strictly against the provided Knowledge Base chunks:
- Use ONLY these 4 classifications: COMPLIANT, DISPUTE_ELIGIBLE, POLICY_VIOLATION, HOLD_PENDING.
- Classification guidance grounded in the KB:
  * Duplicate settled toll debit within 10 minutes at same plaza for same vehicle with distinct RRNs (the second/duplicate leg) -> DISPUTE_ELIGIBLE, cite DOC-101, chargeback_code: "NETC-DUP-01", dispute_actionable: true. (The first original normal toll leg is COMPLIANT, citing DOC-101 or DOC-102 as verified primary debit.)
  * Annual Pass applied on State Highway (SH), municipal parking, or private expressway -> POLICY_VIOLATION, cite DOC-102, chargeback_code: "NETC-PASS-EXCL", dispute_actionable: true (requires wallet re-billing / SLA adjustment packet).
  * Exception Code 08 (E-Notice / Blacklist) 2x penalty -> POLICY_VIOLATION, cite DOC-103, chargeback_code: "NETC-EX08-BLOCKED", dispute_actionable: true (packet explains regularization prerequisite before any dispute).
  * Corporate fuel card swipe > ₹5,000 with GST invoice AND within 25 km on-route -> COMPLIANT, cite DOC-104, chargeback_code: "N/A", dispute_actionable: false.
  * Corporate fuel card swipe > ₹5,000 off-corridor (>25 km) and/or missing GST invoice -> POLICY_VIOLATION, cite DOC-104, chargeback_code: "1PAY-SLA-FUEL-HOLD", dispute_actionable: true (Fleet Admin hold & compliance memo).
  * Settlement status PENDING -> HOLD_PENDING, cite DOC-106, chargeback_code: "HOLD-UNSETTLED", dispute_actionable: true (pre-arbitration hold memo blocking chargeback until POSTED).
  * Normal settled NH toll -> COMPLIANT, cite DOC-102 (valid NH toll) or DOC-106 (settled POSTED status), chargeback_code: "N/A", dispute_actionable: false.
- Every single row MUST have a valid primary_citation matching an exact chunk_id from the Knowledge Base (e.g., "DOC-101") and non-empty cited_chunks array.
- Keep rationale concise (1-2 sharp sentences) and strictly grounded in the cited policy text.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  txn_id: { type: Type.STRING },
                  classification: {
                    type: Type.STRING,
                    enum: ['COMPLIANT', 'DISPUTE_ELIGIBLE', 'POLICY_VIOLATION', 'HOLD_PENDING'],
                  },
                  primary_citation: { type: Type.STRING },
                  cited_chunks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  chargeback_code: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  recommended_action: { type: Type.STRING },
                  dispute_actionable: { type: Type.BOOLEAN },
                },
                required: [
                  'txn_id',
                  'classification',
                  'primary_citation',
                  'cited_chunks',
                  'chargeback_code',
                  'rationale',
                  'recommended_action',
                  'dispute_actionable',
                ],
              },
            },
          },
          required: ['results'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{"results":[]}').trim()) as {
      results: Omit<RowAuditResult, 'retrieved_chunks'>[];
    };

    const validChunkIds = new Set(chunks.map((c) => c.chunk_id));
    const enrichedResults: RowAuditResult[] = parsed.results.map((item) => {
      const retrieved = retrievalMap.get(item.txn_id) ?? [];
      const sanitizedCitations = item.cited_chunks.filter((id) => validChunkIds.has(id));
      const primary = validChunkIds.has(item.primary_citation)
        ? item.primary_citation
        : sanitizedCitations[0] ?? retrieved[0]?.chunk_id ?? 'DOC-101';

      return {
        ...item,
        primary_citation: primary,
        cited_chunks: sanitizedCitations.length > 0 ? sanitizedCitations : [primary],
        retrieved_chunks: retrieved.slice(0, 3),
      };
    });

    const payload: BatchAuditResponse = {
      batch_id: batch_id ?? 'BATCH-NETC-2026-1119',
      client_name: client_name ?? 'Apex Freight Carriers Pvt Ltd',
      model: TEXT_MODEL,
      latency_ms: Date.now() - start,
      audited_at: new Date().toISOString(),
      results: enrichedResults,
    };

    res.json(payload);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// POST /api/dispute-packet — Generates a formal NPCI / 1Pay SLA Dispute Packet memo
apiRouter.post('/dispute-packet', async (req, res) => {
  const start = Date.now();
  try {
    const { transaction, auditResult, relatedTransaction, chunks, client_name } = req.body as {
      transaction: FleetTransaction;
      auditResult: RowAuditResult;
      relatedTransaction?: FleetTransaction | null;
      chunks: PolicyChunk[];
      client_name?: string;
    };

    if (!transaction || !auditResult || !Array.isArray(chunks)) {
      res.status(400).json({ error: 'transaction, auditResult, and chunks are required.' });
      return;
    }

    const ai = getGenAIClient();

    const relevantIds = new Set([...auditResult.cited_chunks, auditResult.primary_citation, 'DOC-105']);
    const relevantChunks = chunks.filter((c) => relevantIds.has(c.chunk_id));

    const policyBlock = relevantChunks
      .map((c) => `[${c.chunk_id} | ${c.source_doc} ${c.section}] ${c.title}: ${c.content}`)
      .join('\n');

    const relatedInfo = relatedTransaction
      ? `\nRelated Counterpart Transaction:\n${relatedTransaction.txn_id} | Vehicle: ${relatedTransaction.vehicle_reg} | Plaza: ${relatedTransaction.plaza_or_merchant} | Amount: ₹${relatedTransaction.amount_inr} | Time: ${relatedTransaction.timestamp} | RRN: ${relatedTransaction.rrn} | Status: ${relatedTransaction.settlement_status}`
      : '';

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Client Entity: ${client_name ?? 'Apex Freight Carriers Pvt Ltd'} (GSTIN: 27AABCA8921F1Z5)
Flagged Transaction:
${transaction.txn_id} | Vehicle: ${transaction.vehicle_reg} | Plaza/Merchant: ${transaction.plaza_or_merchant} | Amount: ₹${transaction.amount_inr} | Status: ${transaction.settlement_status} | Timestamp: ${transaction.timestamp} | RRN: ${transaction.rrn} | Corridor: ${transaction.corridor_note} | Notes: ${transaction.notes}${relatedInfo}

Audit Classification: ${auditResult.classification}
Primary Citation: [${auditResult.primary_citation}]
Chargeback / Action Code: ${auditResult.chargeback_code}
Audit Finding: ${auditResult.rationale}

Governing Policy Clauses:
${policyBlock}

Generate a formal B2B NPCI NETC / 1Pay SLA Dispute & Compliance Memo.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You draft formal, audit-ready B2B NPCI NETC Chargeback & 1Pay Fleet SLA Compliance Memos for Indian commercial fleet operators.
- Cite ONLY the provided policy chunks using exact [DOC-XXX] identifiers.
- Reflect exact eligibility rules:
  * Duplicate settled toll (DOC-101): ELIGIBLE_FOR_FILING with reason code NETC-DUP-01 within 15 days.
  * PENDING authorization (DOC-106): BLOCKED_HOLD_REQUIRED until status transitions to POSTED.
  * Exception Code 08 penalty (DOC-103): REGULARIZATION_REQUIRED (cannot be disputed until KYC/balance is regularized).
  * Off-corridor fuel without GST (DOC-104) or State Highway Annual Pass violation (DOC-102): BLOCKED_HOLD_REQUIRED or REGULARIZATION_REQUIRED with clear Fleet Admin sign-off / wallet re-billing directives.
- Always ground SLA resolution TAT in DOC-105 (3–5 working days Level 1, 8–10 business days Level 2 before Nodal Officer escalation).`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filing_authority: { type: Type.STRING },
            chargeback_code: { type: Type.STRING },
            eligibility_status: {
              type: Type.STRING,
              enum: ['ELIGIBLE_FOR_FILING', 'BLOCKED_HOLD_REQUIRED', 'REGULARIZATION_REQUIRED'],
            },
            sla_timeline: { type: Type.STRING },
            subject_line: { type: Type.STRING },
            executive_summary: { type: Type.STRING },
            policy_citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chunk_id: { type: Type.STRING },
                  source_doc: { type: Type.STRING },
                  clause_application: { type: Type.STRING },
                },
                required: ['chunk_id', 'source_doc', 'clause_application'],
              },
            },
            formal_narrative: { type: Type.STRING },
            required_annexures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            escalation_steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'filing_authority',
            'chargeback_code',
            'eligibility_status',
            'sla_timeline',
            'subject_line',
            'executive_summary',
            'policy_citations',
            'formal_narrative',
            'required_annexures',
            'escalation_steps',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
      DisputePacket,
      'memo_id' | 'generated_at' | 'txn_id' | 'vehicle_reg' | 'latency_ms'
    >;

    const packet: DisputePacket = {
      memo_id: `1PAY-MEMO-${transaction.txn_id}-${Date.now().toString().slice(-4)}`,
      generated_at: new Date().toISOString(),
      txn_id: transaction.txn_id,
      vehicle_reg: transaction.vehicle_reg,
      ...parsed,
      latency_ms: Date.now() - start,
    };

    res.json(packet);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// POST /api/rag-query — Interactive Knowledge Base Retrieval Sandbox
apiRouter.post('/rag-query', async (req, res) => {
  try {
    const { query, chunks } = req.body as {
      query: string;
      chunks: PolicyChunk[];
    };

    if (!query || !query.trim() || !Array.isArray(chunks)) {
      res.status(400).json({ error: 'Non-empty query and chunks array are required.' });
      return;
    }

    const ai = getGenAIClient();
    const result = await runSingleRagQuery(ai, query.trim(), chunks);
    res.json(result);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// POST /api/run-evals — 5-Case RAG Evaluation Suite (Retrieval Recall + Citation Faithfulness)
apiRouter.post('/run-evals', async (req, res) => {
  try {
    const { chunks } = req.body as { chunks: PolicyChunk[] };
    if (!Array.isArray(chunks) || chunks.length === 0) {
      res.status(400).json({ error: 'chunks array is required.' });
      return;
    }

    const ai = getGenAIClient();
    const validChunkIds = new Set(chunks.map((c) => c.chunk_id));

    const evalDefinitions: Array<{
      eval_id: string;
      name: string;
      category: 'RETRIEVAL_RECALL' | 'HALLUCINATION_GUARDRAIL';
      query: string;
      expected_chunk_id: string | null;
      expected_grounded: boolean;
    }> = [
      {
        eval_id: 'EVAL-01',
        name: 'State Highway Annual Pass Exclusion',
        category: 'RETRIEVAL_RECALL',
        query:
          'Can Apex Freight apply an NETC Annual Pass on Maharashtra State Highway SH-27 or private expressways, or how must it be billed?',
        expected_chunk_id: 'DOC-102',
        expected_grounded: true,
      },
      {
        eval_id: 'EVAL-02',
        name: 'Off-Corridor Fuel Card Swipe Without GST Invoice',
        category: 'RETRIEVAL_RECALL',
        query:
          'A driver swiped ₹7,800 on a corporate prepaid fuel card 210 km off the assigned trip corridor without a GSTIN tax invoice. What does the 1Pay Fleet SLA mandate?',
        expected_chunk_id: 'DOC-104',
        expected_grounded: true,
      },
      {
        eval_id: 'EVAL-03',
        name: 'Duplicate RFID Plaza Chargeback Eligibility',
        category: 'RETRIEVAL_RECALL',
        query:
          'Vehicle MH-04-DK-9910 incurred two settled toll debits at Khalapur NH-48 Plaza 3 minutes apart with distinct RRNs. What chargeback reason code and window apply?',
        expected_chunk_id: 'DOC-101',
        expected_grounded: true,
      },
      {
        eval_id: 'EVAL-04',
        name: 'Pending Authorization Pre-Arbitration Block',
        category: 'RETRIEVAL_RECALL',
        query:
          'Can our ops team generate and submit a formal NPCI chargeback packet while a plaza transaction is still in PENDING settlement status?',
        expected_chunk_id: 'DOC-106',
        expected_grounded: true,
      },
      {
        eval_id: 'EVAL-05',
        name: 'Out-of-Scope Cross-Border Customs Guardrail',
        category: 'HALLUCINATION_GUARDRAIL',
        query:
          'What is the NPCI reimbursement ceiling for international cross-border customs brokerage duties and overnight driver detention allowances on Nepal freight corridors?',
        expected_chunk_id: null,
        expected_grounded: false,
      },
    ];

    const caseResults: EvalCaseTrace[] = await Promise.all(
      evalDefinitions.map(async (def) => {
        const ragRes = await runSingleRagQuery(ai, def.query, chunks);
        const inlineCitations = extractInlineCitations(ragRes.answer);
        const allCited = Array.from(new Set([...ragRes.cited_chunk_ids, ...inlineCitations]));
        const top2Ids = ragRes.retrieved_chunks.slice(0, 2).map((c) => c.chunk_id);

        const retrievedTop4Ids = new Set(ragRes.retrieved_chunks.slice(0, 4).map((c) => c.chunk_id));
        const fabricated = allCited.filter(
          (id) => !validChunkIds.has(id) || !retrievedTop4Ids.has(id)
        );

        let retrievalRecallPass = false;
        let citationFaithfulnessPass = false;
        let failureReason: string | null = null;

        if (def.expected_grounded && def.expected_chunk_id) {
          retrievalRecallPass = top2Ids.includes(def.expected_chunk_id);
          const citedExpected = allCited.includes(def.expected_chunk_id);
          citationFaithfulnessPass =
            ragRes.grounded === true && citedExpected && fabricated.length === 0;

          if (!retrievalRecallPass) {
            failureReason = `Expected ${def.expected_chunk_id} in top-2 retrieved chunks (got ${top2Ids.join(', ')}).`;
          } else if (!citationFaithfulnessPass) {
            failureReason =
              fabricated.length > 0
                ? `Fabricated citation(s) detected: ${fabricated.join(', ')}.`
                : `Model failed to ground or cite expected clause [${def.expected_chunk_id}].`;
          }
        } else {
          const topScore = ragRes.retrieved_chunks[0]?.combined_score ?? 0;
          retrievalRecallPass = topScore < 0.72 || ragRes.grounded === false;
          citationFaithfulnessPass =
            ragRes.grounded === false && allCited.length === 0 && fabricated.length === 0;

          if (!citationFaithfulnessPass) {
            failureReason =
              allCited.length > 0
                ? `Hallucination detected: model cited [${allCited.join(', ')}] on an out-of-scope query.`
                : 'Model failed to refuse an out-of-scope policy question.';
          }
        }

        return {
          eval_id: def.eval_id,
          name: def.name,
          category: def.category,
          query: def.query,
          expected_chunk_id: def.expected_chunk_id,
          expected_grounded: def.expected_grounded,
          actual_grounded: ragRes.grounded,
          retrieved_chunks: ragRes.retrieved_chunks.slice(0, 4),
          cited_chunk_ids: ragRes.cited_chunk_ids,
          inline_citations_found: inlineCitations,
          fabricated_citations: fabricated,
          answer: ragRes.answer,
          retrieval_recall_pass: retrievalRecallPass,
          citation_faithfulness_pass: citationFaithfulnessPass,
          overall_pass: retrievalRecallPass && citationFaithfulnessPass,
          failure_reason: failureReason,
          latency_ms: ragRes.latency_ms,
        };
      })
    );

    const totalCases = caseResults.length;
    const passedCases = caseResults.filter((c) => c.overall_pass).length;
    const recallPassed = caseResults.filter((c) => c.retrieval_recall_pass).length;
    const faithfulnessPassed = caseResults.filter((c) => c.citation_faithfulness_pass).length;
    const avgLatency = Math.round(
      caseResults.reduce((acc, c) => acc + c.latency_ms, 0) / Math.max(totalCases, 1)
    );

    const payload: EvalSuiteResponse = {
      run_id: `EVAL-RUN-${Date.now().toString().slice(-6)}`,
      executed_at: new Date().toISOString(),
      model: TEXT_MODEL,
      embedding_model: EMBEDDING_MODEL,
      total_cases: totalCases,
      passed_cases: passedCases,
      pass_rate_pct: Math.round((passedCases / totalCases) * 100),
      retrieval_recall_pct: Math.round((recallPassed / totalCases) * 100),
      citation_faithfulness_pct: Math.round((faithfulnessPassed / totalCases) * 100),
      avg_latency_ms: avgLatency,
      cases: caseResults,
    };

    res.json(payload);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

export const app = express();
app.use(express.json({ limit: '2mb' }));

// Mount API router at both /api and root so Vercel rewrites and direct server mounts both match cleanly
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;

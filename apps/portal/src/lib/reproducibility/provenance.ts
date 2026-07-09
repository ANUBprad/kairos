import type {
  ProvenanceRecord,
  ProvenanceChain,
  ProvenanceAction,
  ExperimentManifest,
} from "./types";

interface ProvenanceInput {
  manifest: ExperimentManifest;
  actor: string;
}

function generateProvenanceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `prov-${timestamp}-${random}`;
}

function computeChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function createProvenanceRecord(
  action: ProvenanceAction,
  inputs: string[],
  outputs: string[],
  parameters: Record<string, unknown>,
  parentProvenanceId: string | null,
  actor: string
): ProvenanceRecord {
  return {
    id: generateProvenanceId(),
    timestamp: new Date().toISOString(),
    action,
    actor,
    inputs,
    outputs,
    parameters,
    checksum: computeChecksum({ action, inputs, outputs, parameters }),
    parentProvenanceId,
  };
}

export function buildProvenanceChain(input: ProvenanceInput): ProvenanceChain {
  const { manifest, actor } = input;
  const records: ProvenanceRecord[] = [];

  const createRecord = createProvenanceRecord(
    "created",
    [],
    [manifest.dataset.id],
    { dataset: manifest.dataset },
    null,
    actor
  );
  records.push(createRecord);

  const chunkingRecord = createProvenanceRecord(
    "executed",
    [manifest.dataset.id],
    [`chunked-${manifest.dataset.id}`],
    manifest.pipeline.chunking.parameters,
    createRecord.id,
    actor
  );
  records.push(chunkingRecord);

  const embeddingRecord = createProvenanceRecord(
    "executed",
    [chunkingRecord.outputs[0]],
    [`embedded-${manifest.dataset.id}`],
    manifest.pipeline.embedding.parameters,
    chunkingRecord.id,
    actor
  );
  records.push(embeddingRecord);

  const retrievalRecord = createProvenanceRecord(
    "executed",
    [embeddingRecord.outputs[0]],
    [`retrieved-${manifest.dataset.id}`],
    manifest.pipeline.retrieval.parameters,
    embeddingRecord.id,
    actor
  );
  records.push(retrievalRecord);

  let lastRecord = retrievalRecord;

  if (manifest.pipeline.reranking) {
    const rerankingRecord = createProvenanceRecord(
      "executed",
      [retrievalRecord.outputs[0]],
      [`reranked-${manifest.dataset.id}`],
      manifest.pipeline.reranking.parameters,
      retrievalRecord.id,
      actor
    );
    records.push(rerankingRecord);
    lastRecord = rerankingRecord;
  }

  const generationRecord = createProvenanceRecord(
    "executed",
    [lastRecord.outputs[0]],
    [`answers-${manifest.dataset.id}`],
    manifest.pipeline.generation.parameters,
    lastRecord.id,
    actor
  );
  records.push(generationRecord);

  const evaluationRecord = createProvenanceRecord(
    "evaluated",
    [generationRecord.outputs[0]],
    [`metrics-${manifest.dataset.id}`],
    manifest.pipeline.evaluation.parameters,
    generationRecord.id,
    actor
  );
  records.push(evaluationRecord);

  const analysisRecord = createProvenanceRecord(
    "analyzed",
    [evaluationRecord.outputs[0]],
    [`report-${manifest.manifestId}`],
    manifest.config,
    evaluationRecord.id,
    actor
  );
  records.push(analysisRecord);

  const exportRecord = createProvenanceRecord(
    "exported",
    [analysisRecord.outputs[0]],
    [manifest.manifestId],
    { manifestVersion: manifest.manifestVersion },
    analysisRecord.id,
    actor
  );
  records.push(exportRecord);

  const chainIntegrity = verifyChainIntegrity(records);

  return {
    records,
    chainId: `chain-${manifest.manifestId}`,
    startTimestamp: records[0].timestamp,
    endTimestamp: records[records.length - 1].timestamp,
    integrity: chainIntegrity,
  };
}

export function verifyChainIntegrity(records: ProvenanceRecord[]): boolean {
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (record.parentProvenanceId) {
      const parent = records.find((r) => r.id === record.parentProvenanceId);
      if (!parent) return false;
    }
  }

  for (const record of records) {
    const expectedChecksum = computeChecksum({
      action: record.action,
      inputs: record.inputs,
      outputs: record.outputs,
      parameters: record.parameters,
    });
    if (record.checksum !== expectedChecksum) return false;
  }

  return true;
}

export function getProvenancePath(
  chain: ProvenanceChain,
  recordId: string
): ProvenanceRecord[] {
  const path: ProvenanceRecord[] = [];
  const recordMap = new Map(chain.records.map((r) => [r.id, r]));

  let currentId: string | null = recordId;
  while (currentId) {
    const record = recordMap.get(currentId);
    if (!record) break;
    path.unshift(record);
    currentId = record.parentProvenanceId;
  }

  return path;
}

export function getProvenanceSummary(chain: ProvenanceChain): {
  totalActions: number;
  actionCounts: Record<ProvenanceAction, number>;
  uniqueActors: string[];
  timespan: number;
  integrity: boolean;
} {
  const actionCounts = {} as Record<ProvenanceAction, number>;
  const actors = new Set<string>();

  for (const record of chain.records) {
    actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;
    actors.add(record.actor);
  }

  const startTime = new Date(chain.startTimestamp).getTime();
  const endTime = new Date(chain.endTimestamp).getTime();
  const timespan = (endTime - startTime) / 1000;

  return {
    totalActions: chain.records.length,
    actionCounts,
    uniqueActors: Array.from(actors),
    timespan,
    integrity: chain.integrity,
  };
}

export function provenanceToMarkdown(chain: ProvenanceChain): string {
  const lines: string[] = [];

  lines.push("# Provenance Chain");
  lines.push("");
  lines.push(`- Chain ID: ${chain.chainId}`);
  lines.push(`- Start: ${chain.startTimestamp}`);
  lines.push(`- End: ${chain.endTimestamp}`);
  lines.push(`- Integrity: ${chain.integrity ? "Valid" : "Invalid"}`);
  lines.push("");

  const summary = getProvenanceSummary(chain);
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total actions: ${summary.totalActions}`);
  lines.push(`- Unique actors: ${summary.uniqueActors.join(", ")}`);
  lines.push(`- Timespan: ${summary.timespan.toFixed(1)} seconds`);
  lines.push("");

  lines.push("## Action Timeline");
  lines.push("");
  for (const record of chain.records) {
    lines.push(`### ${record.action.charAt(0).toUpperCase() + record.action.slice(1)}`);
    lines.push(`- ID: ${record.id}`);
    lines.push(`- Timestamp: ${record.timestamp}`);
    lines.push(`- Actor: ${record.actor}`);
    lines.push(`- Inputs: ${record.inputs.join(", ") || "none"}`);
    lines.push(`- Outputs: ${record.outputs.join(", ") || "none"}`);
    lines.push(`- Checksum: ${record.checksum}`);
    if (record.parentProvenanceId) {
      lines.push(`- Parent: ${record.parentProvenanceId}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

import type {
  LineageGraph,
  LineageNode,
  LineageEdge,
  LineageNodeType,
  ExperimentManifest,
} from "./types";

interface LineageBuilderInput {
  manifest: ExperimentManifest;
  parentManifestId?: string;
}

function generateNodeId(type: LineageNodeType, name: string): string {
  return `${type}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function buildDatasetNode(manifest: ExperimentManifest): LineageNode {
  return {
    id: generateNodeId("dataset", manifest.dataset.name),
    type: "dataset",
    name: manifest.dataset.name,
    version: manifest.dataset.id,
    description: `Dataset: ${manifest.dataset.name} (${manifest.dataset.questionCount} questions)`,
    timestamp: manifest.createdAt,
    parameters: {
      source: manifest.dataset.source,
      questionCount: manifest.dataset.questionCount,
      checksum: manifest.dataset.checksum,
    },
    dependencies: [],
    metrics: null,
    metadata: {
      id: manifest.dataset.id,
    },
  };
}

function buildPipelineNode(
  type: LineageNodeType,
  stage: { name: string; version: string; description: string; parameters: Record<string, unknown> },
  manifest: ExperimentManifest
): LineageNode {
  return {
    id: generateNodeId(type, stage.name),
    type,
    name: stage.name,
    version: stage.version,
    description: stage.description,
    timestamp: manifest.createdAt,
    parameters: stage.parameters,
    dependencies: [],
    metrics: null,
    metadata: {},
  };
}

function buildReportNode(manifest: ExperimentManifest): LineageNode {
  return {
    id: `report-${manifest.manifestId}`,
    type: "report",
    name: manifest.experimentName,
    version: "1.0.0",
    description: `Research report: ${manifest.experimentName}`,
    timestamp: manifest.createdAt,
    parameters: manifest.config,
    dependencies: [],
    metrics: manifest.results.aggregatedMetrics,
    metadata: {
      manifestId: manifest.manifestId,
    },
  };
}

function buildManifestNode(manifest: ExperimentManifest): LineageNode {
  return {
    id: `manifest-${manifest.manifestId}`,
    type: "manifest",
    name: manifest.experimentName,
    version: manifest.manifestVersion,
    description: `Experiment manifest for: ${manifest.experimentName}`,
    timestamp: manifest.createdAt,
    parameters: {},
    dependencies: [],
    metrics: null,
    metadata: {
      author: manifest.author,
      tags: manifest.tags,
    },
  };
}

function buildEdges(nodes: LineageNode[]): LineageEdge[] {
  const edges: LineageEdge[] = [];

  const pipelineOrder: LineageNodeType[] = [
    "dataset", "chunking", "embedding", "retrieval", "reranking", "prompt", "generation", "evaluation", "report",
  ];

  for (let i = 0; i < pipelineOrder.length - 1; i++) {
    const sourceType = pipelineOrder[i];
    const targetType = pipelineOrder[i + 1];

    const sourceNodes = nodes.filter((n) => n.type === sourceType);
    const targetNodes = nodes.filter((n) => n.type === targetType);

    for (const source of sourceNodes) {
      for (const target of targetNodes) {
        edges.push({
          id: `edge-${source.id}-${target.id}`,
          source: source.id,
          target: target.id,
          type: i === 0 ? "produced_by" : "used_by",
          metadata: {},
        });
      }
    }
  }

  const reportNodes = nodes.filter((n) => n.type === "report");
  const manifestNodes = nodes.filter((n) => n.type === "manifest");

  for (const report of reportNodes) {
    for (const manifest of manifestNodes) {
      edges.push({
        id: `edge-${manifest.id}-${report.id}`,
        source: manifest.id,
        target: report.id,
        type: "generated_from",
        metadata: {},
      });
    }
  }

  return edges;
}

export function buildLineageGraph(input: LineageBuilderInput): LineageGraph {
  const { manifest } = input;
  const nodes: LineageNode[] = [];

  nodes.push(buildDatasetNode(manifest));
  nodes.push(buildPipelineNode("chunking", manifest.pipeline.chunking, manifest));
  nodes.push(buildPipelineNode("embedding", manifest.pipeline.embedding, manifest));
  nodes.push(buildPipelineNode("retrieval", manifest.pipeline.retrieval, manifest));

  if (manifest.pipeline.reranking) {
    nodes.push(buildPipelineNode("reranking", manifest.pipeline.reranking, manifest));
  }

  nodes.push(buildPipelineNode("prompt", manifest.pipeline.prompt, manifest));
  nodes.push(buildPipelineNode("generation", manifest.pipeline.generation, manifest));
  nodes.push(buildPipelineNode("evaluation", manifest.pipeline.evaluation, manifest));
  nodes.push(buildReportNode(manifest));
  nodes.push(buildManifestNode(manifest));

  const edges = buildEdges(nodes);

  const targets = new Set(edges.map((e) => e.target));
  const sources = new Set(edges.map((e) => e.source));

  const rootNodes = nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
  const leafNodes = nodes.filter((n) => !sources.has(n.id)).map((n) => n.id);

  return {
    nodes,
    edges,
    rootNodes,
    leafNodes,
    metadata: {
      manifestId: manifest.manifestId,
      createdAt: manifest.createdAt,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  };
}

export function mergeLineageGraphs(graphs: LineageGraph[]): LineageGraph {
  const allNodes = new Map<string, LineageNode>();
  const allEdges = new Map<string, LineageEdge>();

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      allNodes.set(node.id, node);
    }
    for (const edge of graph.edges) {
      allEdges.set(edge.id, edge);
    }
  }

  const nodes = Array.from(allNodes.values());
  const edges = Array.from(allEdges.values());

  const targets = new Set(edges.map((e) => e.target));
  const sources = new Set(edges.map((e) => e.source));

  const rootNodes = nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
  const leafNodes = nodes.filter((n) => !sources.has(n.id)).map((n) => n.id);

  return {
    nodes,
    edges,
    rootNodes,
    leafNodes,
    metadata: {
      manifestId: "merged",
      createdAt: new Date().toISOString(),
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  };
}

export function lineageToDOT(graph: LineageGraph): string {
  const lines: string[] = ["digraph lineage {"];

  lines.push("  rankdir=TB;");
  lines.push("  node [shape=box, style=filled];");

  const typeColors: Record<LineageNodeType, string> = {
    dataset: "#4CAF50",
    chunking: "#2196F3",
    embedding: "#9C27B0",
    retrieval: "#FF9800",
    reranking: "#FF5722",
    prompt: "#00BCD4",
    generation: "#E91E63",
    evaluation: "#795548",
    report: "#607D8B",
    manifest: "#9E9E9E",
  };

  for (const node of graph.nodes) {
    const color = typeColors[node.type] || "#9E9E9E";
    lines.push(`  "${node.id}" [label="${node.name}\\n(${node.type})", fillcolor="${color}", fontcolor="white"];`);
  }

  for (const edge of graph.edges) {
    lines.push(`  "${edge.source}" -> "${edge.target}";`);
  }

  lines.push("}");
  return lines.join("\n");
}

export function lineageToMermaid(graph: LineageGraph): string {
  const lines: string[] = ["graph TD"];

  const nodeIdMap = new Map<string, string>();
  graph.nodes.forEach((node, i) => {
    nodeIdMap.set(node.id, `N${i}`);
  });

  for (const node of graph.nodes) {
    const mermaidId = nodeIdMap.get(node.id);
    lines.push(`  ${mermaidId}["${node.name}<br/>(${node.type})"]`);
  }

  for (const edge of graph.edges) {
    const src = nodeIdMap.get(edge.source);
    const tgt = nodeIdMap.get(edge.target);
    if (src && tgt) {
      lines.push(`  ${src} --> ${tgt}`);
    }
  }

  return lines.join("\n");
}

export function getLineagePath(
  graph: LineageGraph,
  sourceId: string,
  targetId: string
): LineageNode[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  const visited = new Set<string>();
  const path: LineageNode[] = [];

  function dfs(currentId: string): boolean {
    if (currentId === targetId) {
      const node = graph.nodes.find((n) => n.id === currentId);
      if (node) path.push(node);
      return true;
    }

    visited.add(currentId);
    const neighbors = adjacency.get(currentId) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          const node = graph.nodes.find((n) => n.id === currentId);
          if (node) path.unshift(node);
          return true;
        }
      }
    }

    return false;
  }

  const found = dfs(sourceId);
  return found ? path : null;
}

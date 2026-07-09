import type {
  Citation,
  CitationType,
  CitationCollection,
  ExperimentManifest,
} from "./types";

interface CitationInput {
  manifest: ExperimentManifest;
}

function generateCitationId(type: CitationType, name: string): string {
  return `cite-${type}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function generateBibtex(citation: Citation): string {
  const key = `${citation.authors[0]?.split(" ").pop() || "unknown"}${citation.year}${citation.type}`;

  const authorStr = citation.authors.join(" and ");

  let entry = `@${citation.type}{${key},\n`;
  entry += `  title = {${citation.title}},\n`;
  entry += `  author = {${authorStr}},\n`;
  entry += `  year = {${citation.year}},\n`;

  if (citation.venue) entry += `  booktitle = {${citation.venue}},\n`;
  if (citation.doi) entry += `  doi = {${citation.doi}},\n`;
  if (citation.url) entry += `  url = {${citation.url}},\n`;

  entry += `}`;
  return entry;
}

function generateAPA(citation: Citation): string {
  const authorStr = citation.authors.length > 2
    ? `${citation.authors[0]} et al.`
    : citation.authors.join(", ");

  let apa = `${authorStr} (${citation.year}). ${citation.title}.`;

  if (citation.venue) {
    apa += ` ${citation.venue}.`;
  }

  if (citation.doi) {
    apa += ` https://doi.org/${citation.doi}`;
  } else if (citation.url) {
    apa += ` ${citation.url}`;
  }

  return apa;
}

function generateKairosCitation(manifest: ExperimentManifest): Citation {
  return {
    id: generateCitationId("benchmark", manifest.experimentName),
    type: "benchmark",
    title: `Kairos Benchmark: ${manifest.experimentName}`,
    authors: [manifest.author || "Kairos User"],
    year: new Date(manifest.createdAt).getFullYear(),
    venue: "Kairos Explainable RAG Research Workbench",
    doi: null,
    url: null,
    accessedAt: new Date().toISOString(),
    bibtex: "",
    apa: "",
  };
}

function generateDatasetCitation(manifest: ExperimentManifest): Citation {
  const citation: Citation = {
    id: generateCitationId("dataset", manifest.dataset.name),
    type: "dataset",
    title: manifest.dataset.name,
    authors: [manifest.dataset.source || "Unknown"],
    year: new Date(manifest.createdAt).getFullYear(),
    venue: "Benchmark Dataset",
    doi: null,
    url: null,
    accessedAt: new Date().toISOString(),
    bibtex: "",
    apa: "",
  };

  citation.bibtex = generateBibtex(citation);
  citation.apa = generateAPA(citation);
  return citation;
}

function generateModelCitation(manifest: ExperimentManifest): Citation {
  const modelName = String(manifest.pipeline.embedding?.name || "unknown");
  return {
    id: generateCitationId("model", modelName),
    type: "model",
    title: `${modelName} Embedding Model`,
    authors: ["OpenAI"],
    year: 2023,
    venue: "OpenAI API",
    doi: null,
    url: "https://platform.openai.com/docs/guides/embeddings",
    accessedAt: new Date().toISOString(),
    bibtex: "",
    apa: "",
  };
}

function generateLibraryCitation(): Citation {
  return {
    id: generateCitationId("library", "kairos"),
    type: "library",
    title: "Kairos: Explainable RAG Research Workbench",
    authors: ["Kairos Team"],
    year: 2024,
    venue: "GitHub Repository",
    doi: null,
    url: "https://github.com/kairos-rag/kairos",
    accessedAt: new Date().toISOString(),
    bibtex: "",
    apa: "",
  };
}

function generateConfigurationCitation(manifest: ExperimentManifest): Citation {
  const retrieval = manifest.pipeline.retrieval?.name || "vector";
  return {
    id: generateCitationId("configuration", retrieval),
    type: "configuration",
    title: `RAG Configuration: ${retrieval} retrieval with ${manifest.pipeline.embedding?.name || "unknown"} embeddings`,
    authors: [manifest.author || "Kairos User"],
    year: new Date(manifest.createdAt).getFullYear(),
    venue: "Kairos Experiment Configuration",
    doi: null,
    url: null,
    accessedAt: new Date().toISOString(),
    bibtex: "",
    apa: "",
  };
}

export function generateCitations(input: CitationInput): CitationCollection {
  const { manifest } = input;

  const citations: Citation[] = [];

  const kairosCite = generateKairosCitation(manifest);
  kairosCite.bibtex = generateBibtex(kairosCite);
  kairosCite.apa = generateAPA(kairosCite);
  citations.push(kairosCite);

  const datasetCite = generateDatasetCitation(manifest);
  citations.push(datasetCite);

  const modelCite = generateModelCitation(manifest);
  modelCite.bibtex = generateBibtex(modelCite);
  modelCite.apa = generateAPA(modelCite);
  citations.push(modelCite);

  const libCite = generateLibraryCitation();
  libCite.bibtex = generateBibtex(libCite);
  libCite.apa = generateAPA(libCite);
  citations.push(libCite);

  const configCite = generateConfigurationCitation(manifest);
  configCite.bibtex = generateBibtex(configCite);
  configCite.apa = generateAPA(configCite);
  citations.push(configCite);

  const bibtexFile = citations.map((c) => c.bibtex).join("\n\n");
  const apaReferences = citations.map((c) => c.apa).join("\n\n");

  return {
    citations,
    manifestId: manifest.manifestId,
    generatedAt: new Date().toISOString(),
    bibtexFile,
    apaReferences,
  };
}

export function citationCollectionToMarkdown(collection: CitationCollection): string {
  const lines: string[] = [];

  lines.push("# Citations");
  lines.push("");
  lines.push(`Generated for manifest: ${collection.manifestId}`);
  lines.push(`Generated at: ${collection.generatedAt}`);
  lines.push("");

  lines.push("## APA References");
  lines.push("");
  for (const citation of collection.citations) {
    lines.push(`${citation.apa}`);
    lines.push("");
  }

  lines.push("## BibTeX");
  lines.push("");
  lines.push("```bibtex");
  lines.push(collection.bibtexFile);
  lines.push("```");
  lines.push("");

  lines.push("## Individual Citations");
  lines.push("");
  for (const citation of collection.citations) {
    lines.push(`### ${citation.title}`);
    lines.push(`- Type: ${citation.type}`);
    lines.push(`- Authors: ${citation.authors.join(", ")}`);
    lines.push(`- Year: ${citation.year}`);
    lines.push(`- Venue: ${citation.venue}`);
    if (citation.doi) lines.push(`- DOI: ${citation.doi}`);
    if (citation.url) lines.push(`- URL: ${citation.url}`);
    lines.push("");
  }

  return lines.join("\n");
}

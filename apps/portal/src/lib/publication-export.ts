export type PublicationFormat = "markdown" | "html" | "latex" | "pdf";

export const PUBLICATION_TITLE = "Kairos: An Explainable RAG Research Workbench";

export interface PublicationSection {
  id: string;
  label: string;
  required: boolean;
}

const TITLE = PUBLICATION_TITLE;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLatex(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, (char) => {
    switch (char) {
      case "\\":
        return "\\textbackslash{}";
      case "~":
        return "\\textasciitilde{}";
      case "^":
        return "\\textasciicircum{}";
      default:
        return `\\${char}`;
    }
  });
}

// The generated paper uses `## ` for top-level sections and `### ` for
// subsections. Drop the disabled optional sections while keeping every
// subsection attached to the section above it.
export function filterMarkdownSections(
  markdown: string,
  enabled: Record<string, boolean>,
  sections: ReadonlyArray<PublicationSection>,
): string {
  const byLabel = new Map(sections.map((section) => [section.label, section]));
  const kept: string[] = [];
  let keep = true;

  for (const line of markdown.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      const section = byLabel.get(heading[1].trim());
      keep = !section || section.required || enabled[section.id] !== false;
    }
    if (keep) kept.push(line);
  }

  return `${kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

// A complete, self-contained HTML document. The body stays verbatim because the
// source is Markdown; escaping it keeps user-supplied run names from injecting
// markup when the file is opened in a browser.
export function toStandaloneHtml(markdown: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(TITLE)}</title>
<style>
body { font-family: ui-serif, Georgia, "Times New Roman", serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2937; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85rem; }
</style>
</head>
<body>
<main>
<pre>${escapeHtml(markdown)}</pre>
</main>
</body>
</html>
`;
}

// A complete LaTeX document that compiles on its own. The body is verbatim, so
// escape the only sequence that could end the environment early.
export function toLatexDocument(markdown: string): string {
  const body = markdown.replace(/\\end\{verbatim\}/g, "\\textbackslash{}end\\{verbatim\\}");
  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[margin=1in]{geometry}
\\title{${escapeLatex(TITLE)}}
\\date{}
\\begin{document}
\\maketitle
\\begin{verbatim}
${body}
\\end{verbatim}
\\end{document}
`;
}

export interface PublicationFile {
  content: string;
  mime: string;
  filename: string;
}

export function publicationExport(format: PublicationFormat, markdown: string): PublicationFile {
  switch (format) {
    case "html":
      return {
        content: toStandaloneHtml(markdown),
        mime: "text/html;charset=utf-8",
        filename: "kairos-paper.html",
      };
    case "latex":
      return {
        content: toLatexDocument(markdown),
        mime: "application/x-tex;charset=utf-8",
        filename: "kairos-paper.tex",
      };
    case "pdf":
      // PDF is produced by the browser's print dialog from the HTML document,
      // not by renaming a text file. Callers branch on this format.
      return {
        content: toStandaloneHtml(markdown),
        mime: "text/html;charset=utf-8",
        filename: "kairos-paper.html",
      };
    default:
      return {
        content: markdown,
        mime: "text/markdown;charset=utf-8",
        filename: "kairos-paper.md",
      };
  }
}

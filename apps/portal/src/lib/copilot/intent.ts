import type { CopilotIntent, IntentDetectionResult, IntentEntity } from "./types";

interface IntentPattern {
  intent: CopilotIntent;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "explain",
    keywords: ["explain", "what is", "what are", "how does", "how do", "tell me about", "describe", "define"],
    patterns: [
      /explain\s+(?:the\s+)?(.+)/i,
      /what\s+is\s+(?:the\s+)?(.+)/i,
      /how\s+(?:does|do)\s+(.+?)(?:\s+work)?/i,
      /tell\s+me\s+about\s+(.+)/i,
    ],
    weight: 1.0,
  },
  {
    intent: "learn",
    keywords: ["learn", "understand", "teach", "educational", "tutorial", "guide"],
    patterns: [
      /(?:i\s+want\s+to|help\s+me)\s+learn\s+(?:about\s+)?(.+)/i,
      /teach\s+me\s+(?:about\s+)?(.+)/i,
      /how\s+can\s+i\s+understand\s+(.+)/i,
    ],
    weight: 0.9,
  },
  {
    intent: "debug",
    keywords: ["debug", "why", "issue", "problem", "error", "failing", "dropping", "decreased", "low"],
    patterns: [
      /why\s+(?:is|did|has|was)\s+(.+)/i,
      /what(?:'s| is)\s+causing\s+(.+)/i,
      /debug\s+(.+)/i,
      /(.+?)\s+(?:is|are)\s+(?:failing|broken|wrong|bad)/i,
    ],
    weight: 1.0,
  },
  {
    intent: "compare",
    keywords: ["compare", "vs", "versus", "difference", "better", "worse", "对比"],
    patterns: [
      /compare\s+(.+?)\s+(?:vs|versus|and|with)\s+(.+)/i,
      /(?:which|what)\s+(?:is\s+)?(?:better|worse)\s*[,:]\s*(.+?)\s+or\s+(.+)/i,
      /(.+?)\s+(?:vs|versus)\s+(.+)/i,
    ],
    weight: 1.0,
  },
  {
    intent: "recommend",
    keywords: ["recommend", "suggest", "should", "advice", "propose", "next"],
    patterns: [
      /(?:what|which)\s+should\s+(?:i|we)\s+(?:do|test|try|run)/i,
      /recommend\s+(?:a\s+)?(.+)/i,
      /suggest\s+(?:a\s+)?(.+)/i,
      /what(?:'s| is)\s+the\s+best\s+(?:next\s+)?(.+)/i,
    ],
    weight: 1.0,
  },
  {
    intent: "plan",
    keywords: ["plan", "roadmap", "strategy", "queue", "experiment plan", "what next"],
    patterns: [
      /(?:create|make|build)\s+(?:a\s+)?(?:research\s+)?plan/i,
      /what\s+(?:should\s+)?(?:i|we)\s+(?:do|test)\s+next/i,
      /plan\s+(?:my|our)\s+(?:next\s+)?experiments?/i,
    ],
    weight: 0.95,
  },
  {
    intent: "optimize",
    keywords: ["optimize", "improve", "faster", "better", "boost", "enhance", "maximize"],
    patterns: [
      /optimize\s+(.+)/i,
      /how\s+(?:can|do)\s+(?:i|we)\s+improve\s+(.+)/i,
      /make\s+(.+?)\s+(?:faster|better|more\s+accurate)/i,
    ],
    weight: 0.95,
  },
  {
    intent: "interpret",
    keywords: ["interpret", "meaning", "significance", "implication", "insight"],
    patterns: [
      /what\s+does\s+(.+?)\s+mean/i,
      /interpret\s+(?:this|the|these)\s+(.+)/i,
      /what(?:'s| is)\s+the\s+(?:significance|meaning|implication)\s+of\s+(.+)/i,
    ],
    weight: 0.9,
  },
  {
    intent: "summarize",
    keywords: ["summarize", "summary", "overview", "brief", "recap"],
    patterns: [
      /summarize\s+(.+)/i,
      /(?:give\s+(?:me\s+)?)?a\s+summary\s+of\s+(.+)/i,
      /what(?:'s| is)\s+(?:the\s+)?(?:current\s+)?status/i,
    ],
    weight: 0.85,
  },
  {
    intent: "explore",
    keywords: ["explore", "show", "list", "display", "find", "search", "browse"],
    patterns: [
      /show\s+me\s+(.+)/i,
      /(?:list|display)\s+(?:all\s+)?(.+)/i,
      /find\s+(.+)/i,
    ],
    weight: 0.8,
  },
  {
    intent: "review",
    keywords: ["review", "evaluate", "assess", "audit", "check"],
    patterns: [
      /review\s+(.+)/i,
      /evaluate\s+(.+)/i,
      /(?:how|what)\s+(?:is|are)\s+(?:the\s+)?(?:quality|status|health)\s+of\s+(.+)/i,
    ],
    weight: 0.85,
  },
  {
    intent: "validate",
    keywords: ["validate", "verify", "confirm", "correct", "accurate"],
    patterns: [
      /validate\s+(.+)/i,
      /is\s+(.+?)\s+(?:correct|accurate|valid|right)/i,
      /verify\s+(.+)/i,
    ],
    weight: 0.85,
  },
];

function extractEntities(query: string): IntentEntity[] {
  const entities: IntentEntity[] = [];

  const metricPatterns = [
    { type: "metric" as const, pattern: /recall(?:@\d+)?/i },
    { type: "metric" as const, pattern: /precision(?:@\d+)?/i },
    { type: "metric" as const, pattern: /(?:mrr|mean\s+reciprocal\s+rank)/i },
    { type: "metric" as const, pattern: /(?:ndcg|n\s*dcg)/i },
    { type: "metric" as const, pattern: /hit\s+rate/i },
    { type: "metric" as const, pattern: /faithfulness/i },
    { type: "metric" as const, pattern: /(?:answer|response)\s+relevancy/i },
    { type: "metric" as const, pattern: /context\s+(?:precision|recall)/i },
    { type: "metric" as const, pattern: /latency/i },
  ];

  for (const { type, pattern } of metricPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.push({
        type,
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }

  const configPatterns = [
    { type: "config" as const, pattern: /(?:hybrid|vector|bm25|keyword)\s+retrieval/i },
    { type: "config" as const, pattern: /(?:ada|voyage|cohere|e5|bge)\s*(?:-\d+)?/i },
    { type: "config" as const, pattern: /(?:cross-encoder|cohere)\s+rerank/i },
    { type: "config" as const, pattern: /chunk\s+size\s*(?:=\s*)?\d+/i },
    { type: "config" as const, pattern: /top[_\s]*k\s*(?:=\s*)?\d+/i },
  ];

  for (const { type, pattern } of configPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.push({
        type,
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }

  const comparisonPatterns = [
    { type: "comparison" as const, pattern: /(.+?)\s+(?:vs\.?|versus|or)\s+(.+)/i },
  ];

  for (const { type, pattern } of comparisonPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.push({
        type,
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }

  const constraintPatterns = [
    { type: "constraint" as const, pattern: /\$\d+/i },
    { type: "constraint" as const, pattern: /\d+\s*(?:minutes?|hours?|mins?|hrs?)/i },
    { type: "constraint" as const, pattern: /(?:only|just|limited)\s+\d+/i },
  ];

  for (const { type, pattern } of constraintPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.push({
        type,
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }

  return entities;
}

function scoreIntent(query: string, pattern: IntentPattern): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  for (const keyword of pattern.keywords) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      score += 0.3;
    }
  }

  for (const regex of pattern.patterns) {
    if (regex.test(query)) {
      score += 0.5;
    }
  }

  return Math.min(1, score * pattern.weight);
}

export function detectIntent(query: string): IntentDetectionResult {
  const entities = extractEntities(query);

  const scores = INTENT_PATTERNS.map((pattern) => ({
    intent: pattern.intent,
    score: scoreIntent(query, pattern),
  }));

  scores.sort((a, b) => b.score - a.score);

  const primaryIntent = scores[0];
  const subIntents = scores
    .filter((s) => s.score > 0.3 && s.intent !== primaryIntent.intent)
    .slice(0, 2)
    .map((s) => s.intent);

  const confidence = primaryIntent.score > 0
    ? Math.min(1, primaryIntent.score + (subIntents.length * 0.1))
    : 0.3;

  return {
    intent: primaryIntent.score > 0 ? primaryIntent.intent : "explore",
    confidence,
    entities,
    subIntents,
  };
}

export function getIntentDescription(intent: CopilotIntent): string {
  const descriptions: Record<CopilotIntent, string> = {
    explain: "Understanding concepts, metrics, or behaviors",
    learn: "Educational content about RAG and evaluation",
    debug: "Identifying issues and root causes",
    compare: "Comparing configurations or experiments",
    recommend: "Getting suggestions for next steps",
    plan: "Planning research strategy and experiments",
    optimize: "Improving performance or efficiency",
    interpret: "Understanding results and implications",
    summarize: "Getting overviews of status or progress",
    explore: "Discovering available data and options",
    review: "Evaluating quality or completeness",
    validate: "Verifying correctness or accuracy",
  };
  return descriptions[intent];
}

export function getExampleQueries(intent: CopilotIntent): string[] {
  const examples: Record<CopilotIntent, string[]> = {
    explain: ["Explain nDCG", "What is MRR?", "How does hybrid retrieval work?"],
    learn: ["Teach me about evaluation metrics", "I want to understand recall@K"],
    debug: ["Why is Recall dropping?", "What's causing low faithfulness?"],
    compare: ["Compare Hybrid vs Vector", "Which is better: ada-002 or voyage?"],
    recommend: ["What should I test next?", "Recommend an experiment"],
    plan: ["Plan my next 5 experiments", "What's the research roadmap?"],
    optimize: ["How can I improve latency?", "Make retrieval more accurate"],
    interpret: ["What does this p-value mean?", "Interpret the effect size"],
    summarize: ["Summarize today's results", "Give me a status overview"],
    explore: ["Show me all benchmarks", "List my configurations"],
    review: ["Review my experiment design", "Evaluate reproducibility"],
    validate: ["Is this result statistically significant?", "Verify the metric calculation"],
  };
  return examples[intent];
}

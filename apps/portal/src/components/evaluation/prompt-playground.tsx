"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Play,
  Save,
  GitCompare,
  Loader2,
  Clock,
  Coins,
  Hash,
  ChevronDown,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";

const MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
  { id: "claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "Google" },
] as const;

type ModelId = (typeof MODELS)[number]["id"];

interface SavedVersion {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  model: ModelId;
  temperature: number;
  maxTokens: number;
  output: string;
  latency: number;
  tokensUsed: number;
  cost: number;
  createdAt: Date;
}

interface Variable {
  name: string;
  value: string;
}

function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const vars: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  return vars;
}

function interpolateVariables(
  text: string,
  variables: Variable[]
): string {
  let result = text;
  for (const v of variables) {
    result = result.replaceAll(`{{${v.name}}}`, v.value);
  }
  return result;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCost(model: ModelId, promptTokens: number, completionTokens: number): number {
  const pricing: Record<ModelId, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
    "claude-3-opus": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    "claude-3-haiku": { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
    "gemini-pro": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  };
  const rates = pricing[model];
  return promptTokens * rates.input + completionTokens * rates.output;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export interface PromptPlaygroundProps {
  initialSystemPrompt?: string;
  initialUserPrompt?: string;
  onSaveVersion?: (version: SavedVersion) => void;
  onCompareSelect?: (versions: SavedVersion[]) => void;
  className?: string;
}

export function PromptPlayground({
  initialSystemPrompt = "",
  initialUserPrompt = "",
  onSaveVersion,
  onCompareSelect,
  className,
}: PromptPlaygroundProps) {
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [userPrompt, setUserPrompt] = useState(initialUserPrompt);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [output, setOutput] = useState("");
  const [latency, setLatency] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [versionName, setVersionName] = useState("");

  const detectedVariables = useMemo(() => {
    const allText = systemPrompt + " " + userPrompt;
    return extractVariables(allText);
  }, [systemPrompt, userPrompt]);

  const syncVariables = useCallback(() => {
    setVariables((prev) => {
      const map = new Map(prev.map((v) => [v.name, v.value]));
      return detectedVariables.map((name) => ({
        name,
        value: map.get(name) ?? "",
      }));
    });
  }, [detectedVariables]);

  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setSystemPrompt(value);
      syncVariables();
    },
    [syncVariables]
  );

  const handleUserPromptChange = useCallback(
    (value: string) => {
      setUserPrompt(value);
      syncVariables();
    },
    [syncVariables]
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput("");
    setLatency(0);
    setTokensUsed(0);
    setCost(0);

    const filledSystem = interpolateVariables(systemPrompt, variables);
    const filledUser = interpolateVariables(userPrompt, variables);

    const start = performance.now();

    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1500));

    const elapsed = performance.now() - start;
    const promptTokens = estimateTokens(filledSystem) + estimateTokens(filledUser);
    const simulatedCompletionTokens = Math.floor(100 + Math.random() * 300);
    const totalTokens = promptTokens + simulatedCompletionTokens;
    const estimatedCost = estimateCost(selectedModel, promptTokens, simulatedCompletionTokens);

    const sampleOutputs: Record<ModelId, string[]> = {
      "gpt-4o": [
        "Based on the provided context, I can analyze the key information and provide a comprehensive response. The system prompt establishes the behavioral guidelines, while the user prompt contains the specific query that needs to be addressed.\n\nHere are the key findings:\n1. The input has been processed through the variable interpolation system\n2. The model parameters (temperature, max tokens) have been applied\n3. The response has been generated according to the specified constraints",
        "I've analyzed the request and here is my response. The variables have been successfully interpolated into the prompt template. The model generated this output using the specified parameters.",
      ],
      "gpt-4o-mini": [
        "Here's a concise analysis based on your prompt. The variables were interpolated and the model produced this response efficiently with lower computational overhead.",
        "Based on the input provided, I can offer the following insights. The prompt template has been filled with the provided variables and processed accordingly.",
      ],
      "claude-3-opus": [
        "I'd be happy to help with this analysis. After carefully reviewing the prompt and its interpolated variables, here is my detailed response:\n\nThe system prompt establishes the context and behavioral framework. The user prompt, with its variables filled in, presents a specific task. I've processed this through the model with the specified temperature and token constraints to generate this output.",
        "Thank you for this interesting prompt. Let me provide a thorough analysis considering all the interpolated variables and the specified model parameters.",
      ],
      "claude-3-haiku": [
        "Quick analysis complete. Variables interpolated, parameters applied, response generated efficiently.",
        "Here is my response based on the filled prompt template. Processed with the specified model parameters.",
      ],
      "gemini-pro": [
        "Analysis based on the provided prompt template with interpolated variables. The model parameters have been applied to generate this response, balancing creativity with coherence based on the temperature setting.",
        "I've processed the request with the specified parameters. Here is the generated output based on your prompt template.",
      ],
    };

    const outputs = sampleOutputs[selectedModel];
    const selectedOutput = outputs[Math.floor(Math.random() * outputs.length)];

    setOutput(selectedOutput);
    setLatency(Math.round(elapsed));
    setTokensUsed(totalTokens);
    setCost(estimatedCost);
    setIsRunning(false);
  }, [systemPrompt, userPrompt, variables, selectedModel]);

  const handleSaveVersion = useCallback(() => {
    if (!output) return;

    const version: SavedVersion = {
      id: generateId(),
      name: versionName || `v${savedVersions.length + 1}`,
      systemPrompt,
      userPrompt,
      model: selectedModel,
      temperature,
      maxTokens,
      output,
      latency,
      tokensUsed,
      cost,
      createdAt: new Date(),
    };

    setSavedVersions((prev) => [...prev, version]);
    setVersionName("");
    onSaveVersion?.(version);
  }, [
    systemPrompt,
    userPrompt,
    selectedModel,
    temperature,
    maxTokens,
    output,
    latency,
    tokensUsed,
    cost,
    versionName,
    savedVersions.length,
    onSaveVersion,
  ]);

  const handleToggleCompare = useCallback(
    (versionId: string) => {
      setSelectedForCompare((prev) => {
        const next = new Set(prev);
        if (next.has(versionId)) {
          next.delete(versionId);
        } else {
          next.add(versionId);
        }
        return next;
      });
    },
    []
  );

  const handleCompare = useCallback(() => {
    const selected = savedVersions.filter((v) => selectedForCompare.has(v.id));
    onCompareSelect?.(selected);
  }, [savedVersions, selectedForCompare, onCompareSelect]);

  const handleCopyOutput = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleReset = useCallback(() => {
    setSystemPrompt("");
    setUserPrompt("");
    setSelectedModel("gpt-4o");
    setTemperature(0.7);
    setMaxTokens(1024);
    setVariables([]);
    setOutput("");
    setLatency(0);
    setTokensUsed(0);
    setCost(0);
    setVersionName("");
  }, []);

  const selectedModelInfo = MODELS.find((m) => m.id === selectedModel);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Left Panel - Prompt Editor */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Prompt Editor</h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw size={14} />
              Reset
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* System Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => handleSystemPromptChange(e.target.value)}
                placeholder="You are a helpful assistant. Use the following context to answer the user's question."
                className={cn(
                  "w-full min-h-[120px] resize-y rounded-[var(--radius-lg)] border border-border bg-bg px-4 py-3",
                  "text-sm text-text-secondary font-mono leading-relaxed placeholder:text-text-tertiary/50",
                  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                )}
              />
            </div>

            {/* User Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                User Prompt
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => handleUserPromptChange(e.target.value)}
                placeholder="Answer the question: {{question}} based on the context."
                className={cn(
                  "w-full min-h-[120px] resize-y rounded-[var(--radius-lg)] border border-border bg-bg px-4 py-3",
                  "text-sm text-text-secondary font-mono leading-relaxed placeholder:text-text-tertiary/50",
                  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                )}
              />
            </div>

            {/* Variable Inputs */}
            {detectedVariables.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                  Variables
                </label>
                <div className="space-y-2">
                  {detectedVariables.map((varName) => (
                    <div key={varName} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-brand bg-brand/10 px-2 py-1 rounded shrink-0">
                        {`{{${varName}}}`}
                      </span>
                      <input
                        type="text"
                        value={variables.find((v) => v.name === varName)?.value ?? ""}
                        onChange={(e) => {
                          setVariables((prev) =>
                            prev.map((v) =>
                              v.name === varName ? { ...v, value: e.target.value } : v
                            )
                          );
                        }}
                        placeholder={`Enter value for ${varName}`}
                        className={cn(
                          "flex-1 h-9 rounded-[var(--radius-lg)] border border-border bg-bg px-3",
                          "text-sm text-text-secondary placeholder:text-text-tertiary/50",
                          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                Model
              </label>
              <div className="relative">
                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className={cn(
                    "w-full h-10 flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-bg px-3",
                    "text-sm text-text-secondary hover:border-border-hover transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedModelInfo?.name}</span>
                    <span className="text-xs text-text-tertiary">{selectedModelInfo?.provider}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-text-tertiary transition-transform",
                      modelDropdownOpen && "rotate-180"
                    )}
                  />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-[var(--radius-lg)] border border-border bg-surface shadow-lg overflow-hidden">
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setModelDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-surface-hover transition-colors",
                          selectedModel === model.id && "bg-brand/5 text-brand"
                        )}
                      >
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-text-tertiary">{model.provider}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Temperature & Max Tokens Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Temperature
                  </label>
                  <span className="text-xs font-mono text-brand">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-hover rounded-full appearance-none cursor-pointer accent-brand"
                />
                <div className="flex justify-between text-[10px] text-text-tertiary">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  max="4096"
                  value={maxTokens}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= 4096) {
                      setMaxTokens(val);
                    }
                  }}
                  className={cn(
                    "w-full h-10 rounded-[var(--radius-lg)] border border-border bg-bg px-3",
                    "text-sm text-text-secondary font-mono",
                    "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Run Button */}
          <div className="px-4 py-3 border-t border-border">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRun}
              disabled={isRunning || (!systemPrompt && !userPrompt)}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Prompt
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel - Output Display */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Output</h3>
            <div className="flex items-center gap-2">
              {output && (
                <Button variant="ghost" size="sm" onClick={handleCopyOutput}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Metrics Row */}
            {(latency > 0 || tokensUsed > 0 || cost > 0) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} className="text-brand" />
                    <span className="text-[10px] font-medium text-text-tertiary">Latency</span>
                  </div>
                  <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
                    {latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(2)}s`}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash size={12} className="text-brand" />
                    <span className="text-[10px] font-medium text-text-tertiary">Tokens</span>
                  </div>
                  <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
                    {tokensUsed.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Coins size={12} className="text-brand" />
                    <span className="text-[10px] font-medium text-text-tertiary">Cost</span>
                  </div>
                  <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
                    ${cost.toFixed(6)}
                  </p>
                </div>
              </div>
            )}

            {/* Output Text */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                Response
              </label>
              <div
                className={cn(
                  "rounded-[var(--radius-lg)] border border-border bg-bg p-4 min-h-[200px]",
                  "transition-all duration-200"
                )}
              >
                {isRunning ? (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-3">
                    <Loader2 size={24} className="animate-spin text-brand" />
                    <span className="text-sm text-text-tertiary">Generating response...</span>
                  </div>
                ) : output ? (
                  <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                    {output}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                    <Play size={24} className="text-text-tertiary/30" />
                    <span className="text-sm text-text-tertiary/50">
                      Run a prompt to see the output
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save Version Section */}
          <div className="px-4 py-3 border-t border-border space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Version name (optional)"
                className={cn(
                  "flex-1 h-10 rounded-[var(--radius-lg)] border border-border bg-bg px-3",
                  "text-sm text-text-secondary placeholder:text-text-tertiary/50",
                  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                )}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleSaveVersion}
                disabled={!output}
              >
                <Save size={14} />
                Save as Version
              </Button>
            </div>

            {/* Compare Controls */}
            {savedVersions.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  {selectedForCompare.size} of {savedVersions.length} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCompare}
                  disabled={selectedForCompare.size < 2}
                >
                  <GitCompare size={14} />
                  Compare ({selectedForCompare.size})
                </Button>
              </div>
            )}
          </div>

          {/* Saved Versions List */}
          {savedVersions.length > 0 && (
            <div className="px-4 pb-4">
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {savedVersions.map((version) => (
                  <div
                    key={version.id}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-lg)] border border-border p-3",
                      "hover:bg-surface-hover transition-colors cursor-pointer",
                      selectedForCompare.has(version.id) && "border-brand/30 bg-brand/5"
                    )}
                    onClick={() => handleToggleCompare(version.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedForCompare.has(version.id)}
                      onChange={() => handleToggleCompare(version.id)}
                      className="rounded border-border accent-brand"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {version.name}
                        </span>
                        <span className="text-[10px] font-mono text-text-tertiary">
                          {version.model}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-text-tertiary">
                          {version.latency}ms
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {version.tokensUsed} tokens
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          ${version.cost.toFixed(6)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-tertiary shrink-0">
                      {version.createdAt.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

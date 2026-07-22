"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EvaluationDataset, EvaluationQuestion } from "./types";

interface DatasetBuilderProps {
  datasets: EvaluationDataset[];
  onCreate?: (data: { name: string; description: string; questions: Omit<EvaluationQuestion, "id">[] }) => void;
  onUpdate?: (_id: string, data: Partial<EvaluationDataset>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string) => void;
  onImport?: (data: string) => void;
  className?: string;
}

export function DatasetBuilder({ datasets, onCreate, onUpdate: _onUpdate, onDelete, onDuplicate, onExport, onImport, className }: DatasetBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [questions, setQuestions] = useState<Omit<EvaluationQuestion, "id">[]>([
    { question: "", expectedAnswer: "", relevantDocumentIds: [], relevantChunkIds: [], difficulty: "medium", topic: "", tags: [], notes: "" },
  ]);
  const addQuestion = useCallback(() => {
    setQuestions((prev) => [...prev, { question: "", expectedAnswer: "", relevantDocumentIds: [], relevantChunkIds: [], difficulty: "medium", topic: "", tags: [], notes: "" }]);
  }, []);

  const removeQuestion = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuestion = useCallback((index: number, field: keyof Omit<EvaluationQuestion, "id">, value: string | string[]) => {
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const validQuestions = questions.filter((q) => q.question.trim());
    if (validQuestions.length === 0) return;
    onCreate?.({ name: newName, description: newDescription, questions: validQuestions });
    setIsCreating(false);
    setNewName("");
    setNewDescription("");
    setQuestions([{ question: "", expectedAnswer: "", relevantDocumentIds: [], relevantChunkIds: [], difficulty: "medium", topic: "", tags: [], notes: "" }]);
  }, [newName, newDescription, questions, onCreate]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        onImport?.(text);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [onImport]);

  const difficultyColors = { easy: "text-success", medium: "text-warning", hard: "text-error" };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
            <Plus size={14} />
            New Dataset
          </Button>
          <Button variant="secondary" size="sm" onClick={handleImport}>
            <Upload size={14} />
            Import JSON
          </Button>
        </div>
      </div>

      {isCreating && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Create Dataset</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1" htmlFor="ds-name">Name</label>
              <input id="ds-name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none" placeholder="My test dataset" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1" htmlFor="ds-desc">Description</label>
              <input id="ds-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none" placeholder="Optional description" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Questions ({questions.length})</span>
              <Button variant="ghost" size="sm" onClick={addQuestion}>
                <Plus size={12} />
                Add
              </Button>
            </div>
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-tertiary">Q{i + 1}</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={q.difficulty}
                      onChange={(e) => updateQuestion(i, "difficulty", e.target.value)}
                      className="text-[10px] rounded border border-border bg-bg px-1.5 py-0.5 text-text-secondary"
                      aria-label={`Difficulty for question ${i + 1}`}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(i)} aria-label={`Remove question ${i + 1}`}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(i, "question", e.target.value)}
                  className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text-primary resize-none focus:border-brand focus:outline-none"
                  rows={2}
                  placeholder="Enter the question..."
                  aria-label={`Question ${i + 1}`}
                />
                <textarea
                  value={q.expectedAnswer}
                  onChange={(e) => updateQuestion(i, "expectedAnswer", e.target.value)}
                  className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text-primary resize-none focus:border-brand focus:outline-none"
                  rows={2}
                  placeholder="Expected answer..."
                  aria-label={`Expected answer for question ${i + 1}`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={q.topic}
                    onChange={(e) => updateQuestion(i, "topic", e.target.value)}
                    className="rounded border border-border bg-bg px-2 py-1 text-xs text-text-primary focus:border-brand focus:outline-none"
                    placeholder="Topic"
                    aria-label={`Topic for question ${i + 1}`}
                  />
                  <input
                    value={q.tags.join(", ")}
                    onChange={(e) => updateQuestion(i, "tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                    className="rounded border border-border bg-bg px-2 py-1 text-xs text-text-primary focus:border-brand focus:outline-none"
                    placeholder="Tags (comma-separated)"
                    aria-label={`Tags for question ${i + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim() || questions.every((q) => !q.question.trim())}>
              Create Dataset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {datasets.map((ds) => (
          <Card
            key={ds.id}
            className={cn("p-4 cursor-pointer transition-all", selectedId === ds.id ? "border-brand" : "hover:border-brand/30")}
            onClick={() => setSelectedId(selectedId === ds.id ? null : ds.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{ds.name}</h3>
                  <Badge variant="default" className="text-[10px]">v{ds.version}</Badge>
                  <Badge variant="default" className="text-[10px]">{ds.questionCount} questions</Badge>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{ds.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => onDuplicate?.(ds.id)} aria-label="Duplicate"><Copy size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => onExport?.(ds.id)} aria-label="Export"><Download size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete?.(ds.id)} aria-label="Delete"><Trash2 size={14} /></Button>
              </div>
            </div>

            {selectedId === ds.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {ds.questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2 rounded-lg bg-bg/50 p-2">
                    <span className="text-[10px] font-medium text-text-tertiary mt-0.5 shrink-0">Q{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary">{q.question}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{q.expectedAnswer || "No expected answer"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] font-medium", difficultyColors[q.difficulty])}>{q.difficulty}</span>
                        {q.topic && <span className="text-[10px] text-text-tertiary">{q.topic}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

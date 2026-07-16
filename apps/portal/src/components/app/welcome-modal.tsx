"use client";

import { useState, useEffect } from "react";
import { X, BookOpen, Upload, FlaskConical, Sparkles, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STORAGE_KEY = "kairos_welcomed";

const steps = [
  {
    icon: BookOpen,
    title: "Create a Knowledge Base",
    description: "Set up a container for your research documents.",
  },
  {
    icon: Upload,
    title: "Upload Documents",
    description: "Add PDFs, text files, or markdown to your knowledge base.",
  },
  {
    icon: FlaskConical,
    title: "Run Retrieval Experiments",
    description: "Test different retrieval strategies on your queries.",
  },
  {
    icon: Sparkles,
    title: "Use the AI Copilot",
    description: "Get AI-powered answers grounded in your documents.",
  },
  {
    icon: BarChart3,
    title: "Benchmark and Evaluate",
    description: "Measure retrieval quality with precision, recall, and relevance scores.",
  },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const welcomed = localStorage.getItem(STORAGE_KEY);
    if (!welcomed) {
      setOpen(true);
    }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleGetStarted}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-description"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="welcome-title" className="text-xl font-semibold text-text-primary">
            Welcome to Kairos
          </h2>
          <button
            onClick={handleGetStarted}
            className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p id="welcome-description" className="text-sm text-text-secondary mb-6">
          An Explainable RAG Research Workbench. Kairos helps you build, experiment with, and
          evaluate retrieval-augmented generation pipelines — with full transparency into how
          answers are constructed from your documents.
        </p>

        <Card className="mb-6 space-y-3">
          <p className="text-sm font-medium text-text-primary">Suggested workflow</p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand mt-0.5">
                  <step.icon size={14} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{step.title}</p>
                  <p className="text-xs text-text-tertiary">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex justify-end">
          <Button variant="primary" size="lg" onClick={handleGetStarted}>
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}

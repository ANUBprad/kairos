"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/telemetry/analytics";

type Step = "welcome" | "workspace" | "upload" | "kb" | "chat" | "complete";

const STEPS: Step[] = ["welcome", "workspace", "upload", "kb", "chat", "complete"];

export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [workspaceName, setWorkspaceName] = useState("");
  const [kbName, setKbName] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  async function handleComplete() {
    setLoading(true);
    trackEvent("onboarding_completed");
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/app");
  }

  function handleSkip() {
    trackEvent("onboarding_skipped");
    router.push("/app");
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {step === "welcome" && (
          <div className="text-center space-y-6">
            <div className="text-5xl">👋</div>
            <h1 className="text-2xl font-bold text-text-primary">Welcome to Kairos</h1>
            <p className="text-text-secondary">
              Let&apos;s set up your RAG research workspace in a few quick steps.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={handleSkip}>Skip</Button>
              <Button onClick={() => setStep("workspace")}>Get Started</Button>
            </div>
          </div>
        )}

        {step === "workspace" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">📁</div>
              <h2 className="text-xl font-bold text-text-primary">Create Your Workspace</h2>
              <p className="text-sm text-text-secondary mt-1">Name your research workspace</p>
            </div>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Research Workspace"
              className="w-full rounded-[var(--radius-xl)] border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-tertiary"
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleSkip} className="flex-1">Skip</Button>
              <Button onClick={() => setStep("upload")} className="flex-1" disabled={!workspaceName.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">📄</div>
              <h2 className="text-xl font-bold text-text-primary">Upload Your First Document</h2>
              <p className="text-sm text-text-secondary mt-1">Add a PDF, DOCX, or TXT file to get started</p>
            </div>
            <div className="border-2 border-dashed border-border rounded-[var(--radius-xl)] p-8 text-center">
              <p className="text-sm text-text-tertiary">Drag & drop or click to upload</p>
              <p className="text-xs text-text-tertiary mt-1">PDF, DOCX, TXT up to 10MB</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep("kb")} className="flex-1">Skip</Button>
              <Button onClick={() => setStep("kb")} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === "kb" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🧠</div>
              <h2 className="text-xl font-bold text-text-primary">Create Knowledge Base</h2>
              <p className="text-sm text-text-secondary mt-1">Name your first knowledge base</p>
            </div>
            <input
              type="text"
              value={kbName}
              onChange={(e) => setKbName(e.target.value)}
              placeholder="My Knowledge Base"
              className="w-full rounded-[var(--radius-xl)] border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-tertiary"
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep("chat")} className="flex-1">Skip</Button>
              <Button onClick={() => setStep("chat")} className="flex-1" disabled={!kbName.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "chat" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <h2 className="text-xl font-bold text-text-primary">Ask Your First Question</h2>
              <p className="text-sm text-text-secondary mt-1">Try asking something about your documents</p>
            </div>
            <textarea
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="What are the main topics in my documents?"
              rows={3}
              className="w-full rounded-[var(--radius-xl)] border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-tertiary resize-none"
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep("complete")} className="flex-1">Skip</Button>
              <Button onClick={() => setStep("complete")} className="flex-1" disabled={!chatQuery.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="text-center space-y-6">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold text-text-primary">You&apos;re All Set!</h2>
            <p className="text-text-secondary">
              Your workspace is ready. Start exploring your documents with AI-powered research.
            </p>
            <Button onClick={handleComplete} disabled={loading} className="px-8">
              {loading ? "Setting up..." : "Go to Dashboard"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

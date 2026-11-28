"use client";

import React, { useEffect, useRef, useState } from "react";

interface WorkflowStage {
  number: string;
  title: string;
  description: string;
}

const STAGES: WorkflowStage[] = [
  {
    number: "01",
    title: "Add sources",
    description:
      "PDFs, web pages, transcripts, notes and connected service content settle into one library.",
  },
  {
    number: "02",
    title: "Process and index",
    description:
      "Kairos extracts, normalizes, chunks, embeds and indexes the material for retrieval.",
  },
  {
    number: "03",
    title: "Ask a question",
    description:
      "A question enters the same workspace where the sources already live.",
  },
  {
    number: "04",
    title: "Retrieve evidence",
    description:
      "Relevant passages are selected and linked back to the sources they came from.",
  },
  {
    number: "05",
    title: "Grounded answer",
    description:
      "The answer is written against that evidence, with citation markers you can follow.",
  },
  {
    number: "06",
    title: "Turn research into outputs",
    description:
      "One library supports a study guide, a structured report and a podcast you can interrupt.",
  },
];

const SOURCE_CHIPS = [
  "PDF",
  "Web page",
  "YouTube",
  "Notes",
  "Google Drive",
  "Notion",
  "GitHub",
];

const PROCESS_STEPS = ["Extract", "Normalize", "Chunk", "Embed", "Index"];

function stateFor(index: number, active: number): string {
  if (index < active) return "complete";
  if (index === active) return "active";
  return "upcoming";
}

export function Workflow() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollStage, setScrollStage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion !== false) return;

    let frame = 0;
    let attached = false;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const next = Math.min(
        STAGES.length - 1,
        Math.floor(progress * STAGES.length),
      );

      section.style.setProperty("--workflow-progress", progress.toFixed(3));
      setScrollStage((current) => (current === next ? current : next));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const attach = () => {
      if (attached) return;
      attached = true;
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      schedule();
    };

    const detach = () => {
      if (!attached) return;
      attached = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) attach();
        else detach();
      },
      { rootMargin: "12% 0px 12% 0px", threshold: 0 },
    );

    observer.observe(section);
    return () => {
      detach();
      observer.disconnect();
    };
  }, [reducedMotion]);

  const activeStage = reducedMotion ? STAGES.length - 1 : scrollStage;

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="kairos-workflow scroll-mt-20"
      data-active-stage={activeStage}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-labelledby="workflow-heading"
      data-testid="workflow"
    >
      <div className="kairos-workflow-scroll">
        <div className="kairos-workflow-sticky kairos-section-wrap">
          <div className="kairos-workflow-copy">
            <p className="kairos-kicker">How Kairos works</p>
            <h2
              id="workflow-heading"
              className="kairos-editorial-title mt-4 text-[34px] sm:text-[44px] lg:text-[52px]"
            >
              From first source
              <br />
              <span className="text-primary">to traceable answer.</span>
            </h2>
            <p className="kairos-lede mt-5 text-sm sm:text-[15px]">
              Follow one research thread through the workspace. Each step stays
              visible as the next one begins.
            </p>

            <ol className="kairos-workflow-rail">
              {STAGES.map((stage, index) => (
                <li
                  key={stage.number}
                  className="kairos-workflow-rail-item"
                  data-stage={index}
                  data-state={stateFor(index, activeStage)}
                >
                  <span className="kairos-workflow-rail-index" aria-hidden="true">
                    {stage.number}
                  </span>
                  <div>
                    <h3>{stage.title}</h3>
                    <p>{stage.description}</p>
                  </div>
                  <span className="kairos-workflow-rail-mark" aria-hidden="true" />
                </li>
              ))}
            </ol>

            <p className="kairos-workflow-note">
              Illustrative workflow — no live data or backend jobs are run here.
            </p>
          </div>

          <div
            className="kairos-workflow-demo"
            data-stage={activeStage}
            data-testid="workflow-demo"
          >
            <div className="kairos-workflow-demo-bar">
              <span className="kairos-workflow-demo-dot" aria-hidden="true" />
              <span>Kairos workspace</span>
              <span className="kairos-workflow-demo-count">
                {String(activeStage + 1).padStart(2, "0")} / 06
              </span>
            </div>

            <div className="kairos-workflow-canvas">
              <section
                className="kairos-workflow-panel"
                data-step={0}
                data-state={stateFor(0, activeStage)}
                aria-label="Stage 1: added sources"
              >
                <p className="kairos-workflow-panel-label">01 · Library</p>
                <div className="kairos-workflow-chips">
                  {SOURCE_CHIPS.map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                </div>
                <p className="kairos-workflow-panel-foot">7 sources collected</p>
              </section>

              <section
                className="kairos-workflow-panel"
                data-step={1}
                data-state={stateFor(1, activeStage)}
                aria-label="Stage 2: process and index"
              >
                <p className="kairos-workflow-panel-label">02 · Index</p>
                <ul className="kairos-workflow-process">
                  {PROCESS_STEPS.map((step, index) => (
                    <li key={step}>
                      <span>{step}</span>
                      <span
                        className="kairos-workflow-progress"
                        style={{ "--step-delay": `${index * 90}ms` } as React.CSSProperties}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className="kairos-workflow-panel"
                data-step={2}
                data-state={stateFor(2, activeStage)}
                aria-label="Stage 3: user question"
              >
                <p className="kairos-workflow-panel-label">03 · Question</p>
                <p className="kairos-workflow-question">
                  What changed in the attention design across these sources?
                </p>
              </section>

              <section
                className="kairos-workflow-panel"
                data-step={3}
                data-state={stateFor(3, activeStage)}
                aria-label="Stage 4: retrieved evidence"
              >
                <p className="kairos-workflow-panel-label">04 · Evidence</p>
                <div className="kairos-workflow-evidence">
                  <span className="kairos-workflow-cite">[1]</span>
                  <p>Attention is applied across the full sequence, not a fixed window.</p>
                </div>
                <div className="kairos-workflow-evidence">
                  <span className="kairos-workflow-cite">[2]</span>
                  <p>Recurrence is retained only where local context still matters.</p>
                </div>
              </section>

              <section
                className="kairos-workflow-panel"
                data-step={4}
                data-state={stateFor(4, activeStage)}
                aria-label="Stage 5: grounded answer"
              >
                <p className="kairos-workflow-panel-label">05 · Answer</p>
                <p className="kairos-workflow-answer">
                  Recurrence gives way to attention over the full sequence.
                  <span className="kairos-workflow-inline-cite">[1][2]</span>
                </p>
              </section>

              <section
                className="kairos-workflow-panel"
                data-step={5}
                data-state={stateFor(5, activeStage)}
                aria-label="Stage 6: research outputs"
              >
                <p className="kairos-workflow-panel-label">06 · Outputs</p>
                <div className="kairos-workflow-outputs">
                  <span>Study guide</span>
                  <span>Report</span>
                  <span>Podcast</span>
                </div>
                <p className="kairos-workflow-panel-foot">
                  One library. Multiple useful outputs. Every answer traceable.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

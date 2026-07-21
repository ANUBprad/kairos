"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
} from "framer-motion";
import { Upload, FileCheck, CheckCircle2, Loader2 } from "lucide-react";
import { SectionHeader } from "./section-header";
import { useParallax } from "./use-parallax";

const uploadSteps = [
  { label: "Validating file...", duration: 0.8 },
  { label: "Extracting metadata...", duration: 0.6 },
  { label: "Processing PDF structure...", duration: 0.7 },
  { label: "Storing document...", duration: 0.5 },
  { label: "Ready", duration: 0 },
];

export function UploadSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const { ref: parallaxRef, y: parallaxY } = useParallax({ output: [120, 0] });

  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!isInView) return;
    let step = 0;
    const runStep = () => {
      if (step >= uploadSteps.length) return;
      setCurrentStep(step);
      if (uploadSteps[step].duration > 0) {
        setTimeout(() => {
          step++;
          runStep();
        }, uploadSteps[step].duration * 1000);
      }
    };
    const timeout = setTimeout(runStep, 600);
    return () => clearTimeout(timeout);
  }, [isInView]);

  return (
    <section
      id="upload"
      ref={sectionRef}
      className="relative min-h-screen flex items-center py-20 md:py-28 overflow-hidden"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <SectionHeader
              number="01 — Ingestion"
              icon={<Upload size={12} className="text-brand" />}
              title="A document enters"
              highlight="Kairos."
              description="Upload a PDF, DOCX, or Markdown file. Kairos validates the structure, extracts metadata, and prepares it for deep analysis."
            />

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-2 pt-4"
            >
              {uploadSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="relative">
                    {i < currentStep ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : i === currentStep ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        {step.label === "Ready" ? (
                          <CheckCircle2 size={16} className="text-success" />
                        ) : (
                          <Loader2 size={16} className="text-brand animate-spin" />
                        )}
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border/50" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium transition-colors duration-300 ${
                      i <= currentStep
                        ? step.label === "Ready"
                          ? "text-success"
                          : "text-text-primary"
                        : "text-text-tertiary"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative flex items-center justify-center min-h-[400px]">
            <motion.div
              ref={(node) => {
                (documentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                (parallaxRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              }}
              style={{ y: parallaxY }}
              className="relative"
            >
              <div className="relative w-72 h-96 rounded-2xl border-2 border-dashed border-border/50 bg-surface/30 flex items-center justify-center overflow-hidden">
                <motion.div
                  animate={isInView ? { y: [-8, 0], opacity: [0, 1] } : {}}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-center space-y-4 p-6"
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-brand/10 flex items-center justify-center">
                    <FileCheck size={28} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      research-paper.pdf
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      42 pages • 2.3 MB
                    </p>
                  </div>
                  {currentStep >= 0 && (
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{
                        width:
                          currentStep >= uploadSteps.length - 1
                            ? "100%"
                            : `${((currentStep + 1) / uploadSteps.length) * 100}%`,
                      }}
                      transition={{ duration: 0.4 }}
                      className="h-1 mx-auto rounded-full bg-brand"
                      style={{ maxWidth: "80%" }}
                    />
                  )}
                </motion.div>

                {currentStep >= 0 && currentStep < uploadSteps.length - 1 && (
                  <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
                    aria-hidden="true"
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

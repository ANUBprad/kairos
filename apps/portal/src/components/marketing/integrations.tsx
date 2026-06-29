"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollReveal, StaggerContainer, staggerItem } from "@/components/shared/scroll-reveal";
import {
  OpenAILogo, AnthropicLogo, GeminiLogo, OllamaLogo, GroqLogo, MistralLogo,
  PineconeLogo, ChromaDBLogo, WeaviateLogo, QdrantLogo, MilvusLogo, FAISSLogo,
  PythonLogo, TypeScriptLogo, GoLogo, JavaLogo,
} from "./integration-logos";

type Integration = {
  name: string;
  Icon: React.ComponentType<{ size?: number }>;
};

type Category = {
  label: string;
  integrations: Integration[];
};

const categories: Category[] = [
  {
    label: "LLMs",
    integrations: [
      { name: "OpenAI", Icon: OpenAILogo },
      { name: "Anthropic", Icon: AnthropicLogo },
      { name: "Gemini", Icon: GeminiLogo },
      { name: "Ollama", Icon: OllamaLogo },
      { name: "Groq", Icon: GroqLogo },
      { name: "Mistral", Icon: MistralLogo },
    ],
  },
  {
    label: "Vector Databases",
    integrations: [
      { name: "Pinecone", Icon: PineconeLogo },
      { name: "ChromaDB", Icon: ChromaDBLogo },
      { name: "Weaviate", Icon: WeaviateLogo },
      { name: "Qdrant", Icon: QdrantLogo },
      { name: "Milvus", Icon: MilvusLogo },
      { name: "FAISS", Icon: FAISSLogo },
    ],
  },
  {
    label: "Languages",
    integrations: [
      { name: "Python", Icon: PythonLogo },
      { name: "TypeScript", Icon: TypeScriptLogo },
      { name: "Go", Icon: GoLogo },
      { name: "Java", Icon: JavaLogo },
    ],
  },
];

function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 select-none"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,90,10,0.08) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
      aria-hidden
    />
  );
}

function OrangeGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[120px] select-none",
        className,
      )}
      style={{ background: "radial-gradient(circle, #FF5A0A 0%, transparent 70%)" }}
      aria-hidden
    />
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.Icon;
  return (
    <motion.div
      variants={staggerItem()}
      className="group flex items-center gap-3 rounded-[12px] border border-border bg-surface/30 px-4 py-3 transition-all duration-300 ease-out hover:scale-[1.03] hover:border-brand/25 hover:bg-surface/60 hover:shadow-glow cursor-default"
    >
      <span className="shrink-0 text-text-tertiary group-hover:text-brand transition-colors duration-300">
        <Icon size={20} />
      </span>
      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors duration-200">
        {integration.name}
      </span>
    </motion.div>
  );
}

function CategorySection({ category, index }: { category: Category; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className={index > 0 ? "mt-12" : "mt-12"}
    >
      <span className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.12em] mb-4">
        {category.label}
      </span>
      <StaggerContainer
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        staggerDelay={0.04}
      >
        {category.integrations.map((integration) => (
          <IntegrationCard key={integration.name} integration={integration} />
        ))}
      </StaggerContainer>
    </motion.div>
  );
}

export function Integrations() {
  return (
    <section id="integrations" className="relative overflow-hidden py-20 md:py-28">
      <DotGrid />
      <OrangeGlow className="top-[-15%] left-[-8%]" />
      <OrangeGlow className="bottom-[-15%] right-[-8%]" />

      <div className="mx-auto max-w-[1280px] px-6 sm:px-8">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-2">
            <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary">
              Works with your stack
            </h2>
            <p className="mt-4 text-[16px] sm:text-[18px] text-text-secondary leading-relaxed">
              Bring your own models, embeddings, vector database, and infrastructure.
              <br className="hidden sm:block" />
              Kairos adapts to your ecosystem<span className="text-brand"> — </span>
              not the other way around.
            </p>
          </div>
        </ScrollReveal>

        {categories.map((cat, idx) => (
          <CategorySection key={cat.label} category={cat} index={idx} />
        ))}
      </div>
    </section>
  );
}

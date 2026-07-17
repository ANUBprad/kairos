"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionWrapper, SectionHeading } from "./section-wrapper";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

const faqs = [
  {
    q: "What makes Kairos different from LangChain or LlamaIndex?",
    a: "LangChain and LlamaIndex are frameworks for assembling RAG pipelines. Kairos is a platform for studying and experimenting with every stage of the RAG pipeline — from chunking to retrieval to prompt construction — with full observability into each step.",
  },
  {
    q: "Do I need an API key to try it?",
    a: "No. Kairos runs in demo mode by default — no authentication required. Upload documents, run retrieval tests, and explore the interface immediately. Bring your own API keys when you're ready to use LLM features.",
  },
  {
    q: "What embedding providers do you support?",
    a: "Kairos supports OpenAI (text-embedding-3-small, text-embedding-3-large) and Gemini (text-embedding-004). The architecture supports adding local models like BGE, E5, MiniLM, and Ollama.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Kairos is self-hosted — your documents never leave your infrastructure. All data stays on your PostgreSQL database. No data is sent to external services unless you configure an AI provider.",
  },
  {
    q: "What LLMs do you support for generation?",
    a: "Kairos supports OpenAI (GPT-4, GPT-4o-mini) and Gemini (2.0 flash). You can configure which model to use for generation in the settings.",
  },
  {
    q: "What chunking strategies are available?",
    a: "Five strategies: Recursive (natural boundaries), Sentence (sentence-aware), Fixed Size (uniform segments), Markdown-Aware (heading-preserving), and Semantic-Ready (paragraph-aware). Each can be configured with custom chunk size and overlap.",
  },
  {
    q: "Can I compare different retrieval configurations?",
    a: "Yes. The Retrieval Lab supports side-by-side comparison. You can run the same query against two different configurations and compare retrieved chunks, similarity scores, and latency.",
  },
  {
    q: "How does the explainable pipeline work?",
    a: "After every query in RAG Chat, the platform displays each stage: user query, retrieval configuration, retrieved chunks with similarity scores, prompt construction, and the final LLM response with citations.",
  },
];

export function FAQSection() {
  return (
    <SectionWrapper id="faq">
      <ScrollReveal>
        <SectionHeading>Frequently Asked Questions</SectionHeading>
      </ScrollReveal>

      <ScrollReveal className="mt-10 mx-auto max-w-[720px]">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-[14px] font-medium">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-[14px] text-text-secondary leading-relaxed">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollReveal>
    </SectionWrapper>
  );
}

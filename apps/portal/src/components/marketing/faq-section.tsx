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
    a: "LangChain and LlamaIndex are frameworks — they give you building blocks to assemble your own RAG pipeline. Kairos is a platform — you send a query, and we handle strategy selection, optimization, and observability automatically. You don't need to be a retrieval expert.",
  },
  {
    q: "How is this different from just using GPT-4 with search?",
    a: "GPT-4 with search applies the same approach to every query. It's expensive for simple lookups and under-powered for complex synthesis. Kairos classifies every query and routes it to the optimal strategy — getting better results at lower cost.",
  },
  {
    q: "Do I need to host anything?",
    a: "No. The SaaS offering is fully managed. Sign up, create an API key, and start querying. If you need self-hosting, we offer Docker Compose and enterprise deployment options.",
  },
  {
    q: "What LLMs do you support?",
    a: "Kairos is provider-agnostic. We support Gemini, OpenAI (GPT-4, GPT-4o), Groq, and Ollama. You can use any combination — or bring your own.",
  },
  {
    q: "What counts as a query?",
    a: "Every request to the /v1/query endpoint counts as one query. Streaming responses count as one query regardless of stream length. Document ingestion, API key management, and analytics calls do not count toward your quota.",
  },
  {
    q: "Can I try it for free?",
    a: "Yes. The Free tier includes 1,000 queries per month with no credit card required. Upgrade when you need more capacity.",
  },
  {
    q: "How does Kairos improve over time?",
    a: "Kairos includes a feedback loop. When users rate responses (thumbs up or down), those signals retrain the strategy selector and budget optimizer. The system gets smarter with every query.",
  },
  {
    q: "What about security and compliance?",
    a: "All data is encrypted in transit (TLS 1.3) and at rest. API keys are hashed with SHA-256. We offer SOC 2 compliance for Enterprise plans. Self-hosted options are available for air-gapped environments.",
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

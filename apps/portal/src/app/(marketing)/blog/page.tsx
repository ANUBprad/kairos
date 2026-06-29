import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export const metadata: Metadata = {
  title: "Blog",
  description: "Engineering deep-dives, product updates, and tutorials from the Kairos team.",
};

const posts = [
  {
    tag: "Product",
    title: "Introducing Kairos: Adaptive Retrieval for Every Query",
    desc: "Today we're announcing Kairos — an adaptive retrieval intelligence platform that classifies every query individually and routes it to the optimal strategy.",
    date: "June 25, 2026",
    readTime: "5 min read",
    slug: "introducing-kairos",
  },
  {
    tag: "Engineering",
    title: "How We Built a Multi-Strategy Retrieval Engine",
    desc: "A technical deep-dive into the architecture behind Kairos's three retrieval strategies — hybrid, MMR with cross-encoder rerank, and iterative multi-hop.",
    date: "June 20, 2026",
    readTime: "12 min read",
    slug: "multi-strategy-retrieval-engine",
  },
  {
    tag: "Engineering",
    title: "Validating Retrieval Quality: Our Benchmarking Methodology",
    desc: "A look at how we measure retrieval quality across 5 domains and 1,020 queries with statistically significant results.",
    date: "June 15, 2026",
    readTime: "8 min read",
    slug: "benchmarking-methodology",
  },
];

const categories = ["All", "Engineering", "Product", "Tutorials"];

export default function BlogPage() {
  return (
    <div className="pt-28 pb-24">
      <div className="mx-auto max-w-[800px] px-6 sm:px-8">
        <ScrollReveal className="text-center mb-12">
          <h1 className="text-[40px] sm:text-[48px] font-semibold tracking-tight text-text-primary">Blog</h1>
          <p className="mt-4 text-[18px] text-text-secondary">Engineering deep-dives, product updates, and tutorials.</p>
        </ScrollReveal>

        <div className="flex items-center justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-1.5 text-sm rounded-[8px] transition-colors ${
                cat === "All"
                  ? "bg-brand text-white"
                  : "bg-surface/50 text-text-secondary hover:text-text-primary border border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {posts.map((post, i) => (
            <ScrollReveal key={post.slug} delay={i * 0.08}>
              <Link href={`/blog/${post.slug}`} className="block group">
                <article className="border border-border rounded-[14px] p-6 hover:border-border-hover transition-colors bg-surface/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="info">{post.tag}</Badge>
                    <span className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Calendar size={12} />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Clock size={12} />
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary group-hover:text-brand transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-text-tertiary leading-relaxed mb-4">
                    {post.desc}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                    Read more <ArrowRight size={14} />
                  </span>
                </article>
              </Link>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-16">
          <div className="p-8 rounded-[14px] border border-border bg-surface/50 text-center">
            <h3 className="text-base font-semibold text-text-primary mb-2">
              Subscribe to our newsletter
            </h3>
            <p className="text-sm text-text-tertiary mb-6">
              Get the latest posts delivered to your inbox.
            </p>
            <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 h-11 px-4 rounded-[10px] border border-border bg-bg text-text-primary text-sm placeholder:text-text-tertiary/60 focus:border-brand/50 focus:ring-2 focus:ring-brand/10 outline-none transition-all"
              />
              <Button variant="primary" size="md">Subscribe</Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./scroll-motion";

interface HeroProps {
  isAuthenticated?: boolean;
}

const HERO_VIDEO = "/landing/sunrise-beach.mp4";
const HERO_POSTER = "/landing/sunrise-beach-poster.jpg";

export function Hero({ isAuthenticated = false }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ledeRef = useRef<HTMLParagraphElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setShowVideo(!media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const reset = () => {
      const layers: (HTMLElement | null)[] = [
        atmosphereRef.current,
        headlineRef.current,
        ledeRef.current,
      ];

      layers.forEach((element) => {
        if (!element) return;
        element.style.transform = "";
        element.style.opacity = "";
      });
    };

    const update = () => {
      frame = 0;
      if (media.matches) {
        reset();
        return;
      }

      const rect = section.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, -rect.top / Math.max(rect.height, 1)),
      );

      if (atmosphereRef.current) {
        atmosphereRef.current.style.transform = `translate3d(0, ${(progress * 24).toFixed(1)}px, 0)`;
      }
      if (headlineRef.current) {
        headlineRef.current.style.transform = `translate3d(0, ${(-progress * 14).toFixed(1)}px, 0)`;
      }
      if (ledeRef.current) {
        ledeRef.current.style.transform = `translate3d(0, ${(-progress * 8).toFixed(1)}px, 0)`;
        ledeRef.current.style.opacity = (1 - progress * 0.1).toFixed(3);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", schedule);
      reset();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video || !showVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(section);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [showVideo]);

  return (
    <section
      ref={sectionRef}
      className="kairos-hero kairos-dark-section relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden pb-24 pt-28 sm:pb-28 sm:pt-32"
      aria-labelledby="hero-heading"
    >
      <div aria-hidden="true" className="kairos-hero-media">
        <Image
          src={HERO_POSTER}
          alt=""
          fill
          priority
          sizes="100vw"
          className="kairos-hero-poster"
        />
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_POSTER}
            tabIndex={-1}
            className="kairos-hero-video"
            data-testid="hero-video"
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        ) : null}
        <div className="kairos-hero-scrim" />
        <div className="kairos-hero-warmth" />
        <div className="kairos-hero-fade" />
      </div>

      <div
        ref={atmosphereRef}
        aria-hidden="true"
        className="kairos-grid pointer-events-none absolute inset-x-0 top-0 z-0 h-[360px] opacity-20"
      />

      <div className="kairos-section-wrap relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <p className="kairos-hero-brand">
              <span aria-hidden="true" className="kairos-hero-brand-rule" />
              Kairos
              <span aria-hidden="true" className="kairos-hero-brand-rule" />
            </p>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1
              ref={headlineRef}
              id="hero-heading"
              className="kairos-editorial-title mt-6 text-[44px] sm:text-[64px] lg:text-[78px]"
            >
              Research that keeps
              <br />
              <span className="text-primary">its receipts.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={140}>
            <p
              ref={ledeRef}
              className="kairos-lede mx-auto mt-6 text-center text-[15px] sm:text-base"
            >
              Kairos reads across your sources, answers with citations you can
              open, then turns the same library into study material and a
              podcast you can interrupt.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="kairos-button kairos-button-light"
              >
                {isAuthenticated ? "Open dashboard" : "Start researching"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/#workflow"
                className="kairos-button border border-border bg-surface/70 text-foreground backdrop-blur-sm hover:bg-surface-hover"
              >
                See the workflow
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

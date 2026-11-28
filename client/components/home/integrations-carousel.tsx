"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Category = "Connected account" | "Source type" | "Processing service";

interface CarouselItem {
  name: string;
  category: Category;
  logo: string;
  darkLogo?: string;
  invertInDark?: boolean;
  logoWidth: number;
  logoHeight: number;
}

interface MeasuredCard {
  element: HTMLDivElement;
  center: number;
}

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
}

const BASE_SPEED = 26;
const PAUSED_SPEED = 0;
const COPIES = 3;

/**
 * Only brands that the application actually uses are shown here. Source
 * formats that have no brand mark stay in the separate file-format row.
 */
const ITEMS: CarouselItem[] = [
  {
    name: "Google Drive",
    category: "Connected account",
    logo: "/integrations/google-drive-logo.png",
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "Notion",
    category: "Connected account",
    logo: "/integrations/notion-logo.webp",
    darkLogo: "/integrations/notion-logo-white.webp",
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "GitHub",
    category: "Connected account",
    logo: "/integrations/github.svg",
    invertInDark: true,
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "YouTube",
    category: "Source type",
    logo: "/integrations/youtube.svg",
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "Firecrawl",
    category: "Processing service",
    logo: "/integrations/firecrawl.png",
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "Tavily",
    category: "Processing service",
    logo: "/integrations/tavily.svg",
    invertInDark: true,
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "Pinecone",
    category: "Processing service",
    logo: "/integrations/pinecone.png",
    invertInDark: true,
    logoWidth: 36,
    logoHeight: 36,
  },
  {
    name: "ElevenLabs",
    category: "Processing service",
    logo: "/integrations/elevenlabs.svg",
    invertInDark: true,
    logoWidth: 32,
    logoHeight: 32,
  },
  {
    name: "Mem0",
    category: "Processing service",
    logo: "/integrations/mem0.svg",
    invertInDark: true,
    logoWidth: 120,
    logoHeight: 34,
  },
];

function wrap(value: number, size: number): number {
  return size > 0 ? ((value % size) + size) % size : 0;
}

function wrapDistance(value: number, size: number): number {
  if (size <= 0) return value;
  return wrap(value + size / 2, size) - size / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function LogoImage({ item }: { item: CarouselItem }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="kairos-carousel-logo-fallback" aria-hidden="true">
        <span />
      </span>
    );
  }

  const imageClass = cn(
    "kairos-carousel-logo",
    item.invertInDark && "dark:invert",
  );

  if (item.darkLogo) {
    return (
      <span className="kairos-carousel-logo-pair">
        <Image
          src={item.logo}
          alt=""
          aria-hidden="true"
          width={item.logoWidth}
          height={item.logoHeight}
          className={cn(imageClass, "dark:hidden")}
          draggable={false}
          unoptimized
          onError={() => setFailed(true)}
        />
        <Image
          src={item.darkLogo}
          alt=""
          aria-hidden="true"
          width={item.logoWidth}
          height={item.logoHeight}
          className={cn(imageClass, "hidden dark:block")}
          draggable={false}
          unoptimized
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <Image
      src={item.logo}
      alt=""
      aria-hidden="true"
      width={item.logoWidth}
      height={item.logoHeight}
      className={imageClass}
      draggable={false}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

function Placard({
  item,
  cardRef,
}: {
  item: CarouselItem;
  cardRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={cardRef} data-carousel-card data-logo-src={item.logo} className="kairos-carousel-card">
      <div className="kairos-carousel-logo-frame">
        <LogoImage item={item} />
      </div>
      <div className="mt-auto">
        <p className="kairos-carousel-name">{item.name}</p>
        <p className="kairos-carousel-category">{item.category}</p>
      </div>
      <span aria-hidden="true" className="kairos-carousel-card-mark" />
    </div>
  );
}

function MotionCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measuredRef = useRef<MeasuredCard[]>([]);
  const offsetRef = useRef(0);
  const groupWidthRef = useRef(0);
  const stepRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const momentumRef = useRef(0);
  const draggingRef = useRef(false);
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const initializedRef = useRef(false);
  const tweenRef = useRef<Tween | null>(null);
  const pointerRef = useRef({
    id: -1,
    startX: 0,
    lastX: 0,
    startOffset: 0,
    lastTime: 0,
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!viewport || !track || !group) return;

    const measure = () => {
      const width = group.getBoundingClientRect().width;
      if (width <= 0) return;

      groupWidthRef.current = width;
      stepRef.current = width / ITEMS.length;
      measuredRef.current = cardRefs.current
        .filter((element): element is HTMLDivElement => Boolean(element))
        .map((element) => ({
          element,
          center: element.offsetLeft + element.offsetWidth / 2,
        }));

      if (!initializedRef.current && measuredRef.current.length > 0) {
        offsetRef.current =
          measuredRef.current[0].center - viewport.clientWidth / 2;
        initializedRef.current = true;
      } else {
        offsetRef.current = wrap(offsetRef.current, width);
      }
    };

    const render = () => {
      const width = groupWidthRef.current;
      if (width <= 0) return;

      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;

      const viewportWidth = viewport.clientWidth || 1;
      const halfSpan = Math.max(viewportWidth * 0.62, 220);
      const maxRotation =
        viewportWidth < 640 ? 4 : viewportWidth < 1024 ? 7 : 10;

      measuredRef.current.forEach(({ element, center }) => {
        const distance = wrapDistance(
          center - offsetRef.current - viewportWidth / 2,
          width,
        );
        const normalized = Math.min(Math.abs(distance) / halfSpan, 1);
        const eased = normalized * normalized * (3 - 2 * normalized);
        const scale = 1 - 0.22 * eased;
        const opacity = 1 - 0.62 * eased;
        const rotation = -Math.sign(distance) * maxRotation * eased;

        element.style.transform = `perspective(900px) rotateY(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        element.style.opacity = opacity.toFixed(3);
        element.style.zIndex = String(20 - Math.round(eased * 12));
      });
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(group);
    resizeObserver.observe(viewport);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(viewport);

    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (visibleRef.current && !draggingRef.current) {
        const tween = tweenRef.current;

        if (tween) {
          const progress = clamp((now - tween.start) / tween.duration, 0, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          offsetRef.current = tween.from + (tween.to - tween.from) * eased;
          if (progress >= 1) tweenRef.current = null;
        } else {
          const target = pausedRef.current ? PAUSED_SPEED : BASE_SPEED;
          speedRef.current +=
            (target - speedRef.current) * Math.min(1, delta * 3);
          momentumRef.current *= Math.exp(-delta * 3.2);
          if (Math.abs(momentumRef.current) < 1) momentumRef.current = 0;
          offsetRef.current +=
            (speedRef.current + momentumRef.current) * delta;
        }
      }

      if (groupWidthRef.current > 0) {
        offsetRef.current = wrap(offsetRef.current, groupWidthRef.current);
      }
      render();
      frame = requestAnimationFrame(tick);
    };

    measure();
    frame = requestAnimationFrame(tick);

    const onVisibilityChange = () => {
      previous = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const nudge = (direction: -1 | 1) => {
    const width = groupWidthRef.current;
    if (width <= 0) return;

    tweenRef.current = {
      from: offsetRef.current,
      to: offsetRef.current + direction * stepRef.current,
      start: performance.now(),
      duration: 480,
    };
    momentumRef.current = 0;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    if (event.pointerType === "mouse") event.preventDefault();
    draggingRef.current = true;
    tweenRef.current = null;
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      startOffset: offsetRef.current,
      lastTime: performance.now(),
    };
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || event.pointerId !== pointerRef.current.id) return;

    offsetRef.current =
      pointerRef.current.startOffset - (event.clientX - pointerRef.current.startX);

    const now = performance.now();
    const elapsed = Math.max(now - pointerRef.current.lastTime, 8) / 1000;
    const movement = event.clientX - pointerRef.current.lastX;
    momentumRef.current = clamp(-movement / elapsed, -420, 420);
    pointerRef.current.lastX = event.clientX;
    pointerRef.current.lastTime = now;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || event.pointerId !== pointerRef.current.id) return;

    draggingRef.current = false;
    if (performance.now() - pointerRef.current.lastTime > 90) {
      momentumRef.current = 0;
    }

    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    pausedRef.current = false;
  };

  return (
    <div
      className="kairos-carousel"
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        if (!draggingRef.current) pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          pausedRef.current = false;
        }
      }}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Source and service logos"
        tabIndex={0}
        className="kairos-carousel-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(1);
          }
        }}
      >
        <div ref={trackRef} className="kairos-carousel-track">
          {Array.from({ length: COPIES }, (_, copy) => (
            <div
              key={copy}
              ref={copy === 0 ? groupRef : undefined}
              aria-hidden={copy > 0 ? "true" : undefined}
              className="kairos-carousel-group"
            >
              {ITEMS.map((item, index) => (
                <Placard
                  key={`${copy}-${item.name}`}
                  item={item}
                  cardRef={(element) => {
                    cardRefs.current[copy * ITEMS.length + index] = element;
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="kairos-carousel-controls">
        <span className="kairos-carousel-hint">
          Drag to explore · arrows to step
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="kairos-carousel-control"
            aria-label="Previous source or service"
            onClick={() => nudge(-1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="kairos-carousel-control"
            aria-label="Next source or service"
            onClick={() => nudge(1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StaticCarousel() {
  return (
    <div className="kairos-carousel" aria-label="Source and service logos">
      <div className="kairos-carousel-static">
        {ITEMS.map((item) => (
          <Placard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

export function IntegrationsCarousel() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion ? <StaticCarousel /> : <MotionCarousel />;
}

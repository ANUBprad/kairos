"use client";

import React, { useEffect, useRef } from "react";

type CardKind = "pdf" | "website" | "youtube" | "github" | "knowledge" | "chat";

interface PipelineCardData {
  kind: CardKind;
  stage: string;
  meta: string;
  title: string;
  lines: string[];
}

interface MeasuredItem {
  element: HTMLElement;
  raw: HTMLElement;
  structured: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
  stage: string;
  seed: number;
  distance: number;
}

const CARDS: PipelineCardData[] = [
  {
    kind: "pdf",
    stage: "COLLECT",
    meta: "PDF · 14 pages",
    title: "Attention Is All You Need",
    lines: [
      "title=attention-is-all-you-need",
      "pages=14 text_chars=28410",
      "headings=6 tables=3 refs=42",
      "chunk_size=900 overlap=120",
    ],
  },
  {
    kind: "website",
    stage: "COLLECT",
    meta: "WEB · research notes",
    title: "The anatomy of a research note",
    lines: [
      "url=research.example/notes",
      "title=the-anatomy-of-a-note",
      "blocks=18 links=27",
      "canonical_url=validated",
    ],
  },
  {
    kind: "youtube",
    stage: "PROCESS",
    meta: "VIDEO · 18:42",
    title: "How retrieval works",
    lines: [
      "video=how-retrieval-works",
      "transcript_segments=216",
      "timestamps=enabled",
      "language=en confidence=0.96",
    ],
  },
  {
    kind: "github",
    stage: "PROCESS",
    meta: "GITHUB · repository",
    title: "kairos / research-core",
    lines: [
      "repo=kairos/research-core",
      "files=38 readme=parsed",
      "symbols=214 code_blocks=19",
      "branch=main commit=verified",
    ],
  },
  {
    kind: "knowledge",
    stage: "CONNECT",
    meta: "KNOWLEDGE · collected",
    title: "A connected source library",
    lines: [
      "sources=6 entities=31",
      "relations=48 clusters=4",
      "embeddings=512d",
      "index=ready scope=workspace",
    ],
  },
  {
    kind: "chat",
    stage: "INTERACT",
    meta: "AI · grounded answer",
    title: "Ask across every source",
    lines: [
      "query=what-changed-in-attention",
      "citations=4 sources=3",
      "context_chunks=12",
      "answer=grounded stream=complete",
    ],
  },
];

const STAGES = [
  {
    number: "01",
    label: "COLLECT",
    copy: "Documents, websites, videos and repositories enter Kairos.",
  },
  {
    number: "02",
    label: "PROCESS",
    copy: "Content is extracted, cleaned, chunked and embedded.",
  },
  {
    number: "03",
    label: "CONNECT",
    copy: "Structured knowledge is indexed for retrieval.",
  },
  {
    number: "04",
    label: "INTERACT",
    copy: "Ask questions and create outputs from your sources.",
  },
];

const PARTICLE_RANGE = 230;

function hash(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function wrap(value: number, size: number): number {
  return size > 0 ? ((value % size) + size) % size : value;
}

function RawLayer({ card }: { card: PipelineCardData }) {
  return (
    <div
      data-layer="raw"
      className="absolute inset-0 overflow-hidden rounded-2xl border border-[#d6dae0] bg-white p-4 shadow-[0_20px_50px_rgba(20,27,35,0.10)]"
    >
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-[#8b94a3]">
        <span>{card.meta}</span>
        <span className="size-2 rounded-full bg-[#e8663a]" />
      </div>
      <h3 className="mt-3 font-serif text-[17px] leading-snug text-[#1b2027]">
        {card.title}
      </h3>

      {card.kind === "pdf" ? (
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded bg-[#e5e8ec]" />
          <div className="h-1.5 w-11/12 rounded bg-[#e5e8ec]" />
          <div className="h-1.5 w-4/5 rounded bg-[#e5e8ec]" />
          <div className="h-1.5 w-10/12 rounded bg-[#e5e8ec]" />
          <div className="mt-3 rounded-lg border border-[#e5e8ec] bg-[#f7f8fa] p-2 font-mono text-[9px] leading-relaxed text-[#6b7480]">
            “Attention is all you need” — a sequence transduction architecture
            built entirely on attention mechanisms.
          </div>
        </div>
      ) : null}

      {card.kind === "website" ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e8ec]">
          <div className="flex items-center gap-1 border-b border-[#e5e8ec] bg-[#f7f8fa] px-2 py-1.5">
            <span className="size-1.5 rounded-full bg-[#e8663a]/70" />
            <span className="size-1.5 rounded-full bg-[#d6dae0]" />
            <span className="size-1.5 rounded-full bg-[#d6dae0]" />
            <span className="ml-2 truncate font-mono text-[8px] text-[#9aa3b2]">
              research.example/notes
            </span>
          </div>
          <div className="p-2.5">
            <p className="font-serif text-[13px] text-[#1b2027]">
              Writing a note that survives later
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-full rounded bg-[#e5e8ec]" />
              <div className="h-1.5 w-11/12 rounded bg-[#e5e8ec]" />
              <div className="h-1.5 w-3/4 rounded bg-[#e5e8ec]" />
            </div>
          </div>
        </div>
      ) : null}

      {card.kind === "youtube" ? (
        <div className="mt-3">
          <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#202a36] to-[#0f1620]">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/90 text-[11px] text-[#e8663a]">
              ▶
            </span>
            <span className="absolute bottom-1.5 right-2 font-mono text-[8px] text-white/70">
              18:42
            </span>
          </div>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#6b7480]">
            04:18 “We embed the query into the same space as the chunks…”
          </p>
        </div>
      ) : null}

      {card.kind === "github" ? (
        <div className="mt-3 rounded-lg border border-[#e5e8ec] bg-[#f7f8fa] p-2.5 font-mono text-[9px] text-[#5b6472]">
          <div className="flex items-center justify-between border-b border-[#e5e8ec] pb-1.5">
            <span>main</span>
            <span className="text-[#9aa3b2]">38 files</span>
          </div>
          <div className="mt-1.5 space-y-1">
            <div>README.md</div>
            <div>src/retrieve.ts</div>
            <div>src/chunking.ts</div>
          </div>
          <div className="mt-2 rounded bg-[#202a36] px-2 py-1.5 text-[8px] text-[#e8a184]">
            const matches = await retrieve(query);
          </div>
        </div>
      ) : null}

      {card.kind === "knowledge" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["pdf", "transcript", "web", "repo", "citation", "entity"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#e8663a]/25 bg-[#fff4ee] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-[#a55432]"
            >
              {tag}
            </span>
          ))}
          <div className="mt-2 w-full space-y-1.5">
            <div className="h-1.5 w-full rounded bg-[#e5e8ec]" />
            <div className="h-1.5 w-10/12 rounded bg-[#e5e8ec]" />
          </div>
        </div>
      ) : null}

      {card.kind === "chat" ? (
        <div className="mt-3 space-y-2">
          <div className="ml-auto w-4/5 rounded-xl rounded-br-sm bg-[#202a36] px-2.5 py-2 text-[9px] text-white">
            What changed in the attention design?
          </div>
          <div className="w-11/12 rounded-xl rounded-bl-sm border border-[#e5e8ec] bg-[#f7f8fa] px-2.5 py-2 text-[9px] leading-relaxed text-[#4b5563]">
            The paper replaces recurrence with attention over the full sequence.
            <span className="mt-1 block font-mono text-[8px] text-[#e8663a]">
              [1] pdf p.3 · [2] transcript 04:18
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StructuredLayer({ card }: { card: PipelineCardData }) {
  return (
    <div
      data-layer="structured"
      className="absolute inset-0 overflow-hidden rounded-2xl border border-[#e8663a]/30 bg-[#121922] p-4 text-white"
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#e88862]">
        {card.stage} / indexed
      </div>
      <h3 className="mt-2 truncate font-mono text-[12px] text-white/90">{card.title}</h3>
      <div className="mt-3 space-y-1.5 font-mono text-[9px] leading-relaxed text-white/55">
        {card.lines.map((line, index) => (
          <div key={line} className="flex gap-2">
            <span className="shrink-0 text-[#e8663a]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="truncate">{line}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-4 right-4 h-px bg-white/10" />
      <div className="absolute bottom-1.5 left-4 font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
        kairos://knowledge
      </div>
    </div>
  );
}

function PipelineGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div data-group={duplicate ? "second" : "first"} className="flex shrink-0 gap-6 pr-6">
      {CARDS.map((card, index) => (
        <div
          key={`${card.kind}-${duplicate ? "b" : "a"}`}
          className="pipeline-item relative h-[220px] w-[248px] shrink-0 sm:h-[240px] sm:w-[288px] lg:h-[260px] lg:w-[328px]"
          data-seed={index}
        >
          <RawLayer card={card} />
          <StructuredLayer card={card} />
        </div>
      ))}
    </div>
  );
}

export function CinematicPipeline() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const counterStageRef = useRef<HTMLSpanElement | null>(null);
  const counterBarRef = useRef<HTMLSpanElement | null>(null);
  const itemsRef = useRef<MeasuredItem[]>([]);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const speedRef = useRef(34);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const visibleRef = useRef(true);
  const reducedRef = useRef(false);
  const timeRef = useRef(0);
  const wrapWidthRef = useRef(1);
  const trackTopRef = useRef(0);
  const pointerXRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !track || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = motionQuery.matches;

    const measure = () => {
      const group = track.querySelector<HTMLElement>("[data-group]");
      wrapWidthRef.current = Math.max(group?.offsetWidth ?? 1, 1);
      trackTopRef.current =
        track.getBoundingClientRect().top - stage.getBoundingClientRect().top;

      itemsRef.current = Array.from(
        track.querySelectorAll<HTMLElement>(".pipeline-item"),
      ).map((element, index) => ({
        element,
        raw: element.querySelector<HTMLElement>('[data-layer="raw"]')!,
        structured: element.querySelector<HTMLElement>('[data-layer="structured"]')!,
        left: element.offsetLeft + element.offsetWidth / 2,
        top: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
        stage: CARDS[index % CARDS.length].stage,
        seed: (index % CARDS.length) + 1,
        distance: 0,
      }));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(stage.clientWidth * dpr);
      canvas.height = Math.round(stage.clientHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (
      scannerX: number,
      wrappedOffset: number,
      stageWidth: number,
      stageHeight: number,
    ) => {
      context.clearRect(0, 0, stageWidth, stageHeight);

      const haze = context.createRadialGradient(
        scannerX,
        stageHeight / 2,
        0,
        scannerX,
        stageHeight / 2,
        170,
      );
      haze.addColorStop(0, "rgba(232, 102, 58, 0.11)");
      haze.addColorStop(0.5, "rgba(232, 102, 58, 0.04)");
      haze.addColorStop(1, "rgba(232, 102, 58, 0)");
      context.fillStyle = haze;
      context.fillRect(0, 0, stageWidth, stageHeight);

      for (const item of itemsRef.current) {
        const proximity = 1 - Math.abs(item.distance) / PARTICLE_RANGE;
        if (proximity <= 0) continue;

        const top = trackTopRef.current + item.top;
        for (let index = 0; index < 16; index += 1) {
          const px =
            item.left -
            wrappedOffset +
            (hash(item.seed, index) - 0.5) * item.width * 0.92;
          const drift = reducedRef.current
            ? 0
            : Math.sin(timeRef.current * 0.0018 + index * 1.7) * 2.4;
          const py = top + hash(index, item.seed + 7) * item.height + drift;
          const alpha = (0.08 + hash(item.seed + 3, index) * 0.42) * proximity;
          context.fillStyle = `rgba(232, 102, 58, ${alpha.toFixed(3)})`;
          context.fillRect(px, py, 1.6, 1.6);
        }

        for (let index = 0; index < 3; index += 1) {
          const px = item.left - wrappedOffset + (hash(item.seed + 11, index) - 0.5) * 30;
          const py = top + hash(index + 19, item.seed) * item.height;
          const alpha = proximity * (0.32 + hash(item.seed, index + 23) * 0.3);
          context.fillStyle = `rgba(255, 176, 118, ${alpha.toFixed(3)})`;
          context.fillRect(px, py, 2.2, 2.2);
        }
      }
    };

    const render = (now: number) => {
      if (!visibleRef.current) {
        frameRef.current = null;
        return;
      }

      const delta = Math.min(now - lastFrameRef.current || 16, 48);
      lastFrameRef.current = now;

      const targetSpeed = reducedRef.current
        ? 0
        : hoveringRef.current
          ? 9
          : 34;
      speedRef.current += (targetSpeed - speedRef.current) * 0.08;

      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.05) {
          offsetRef.current += velocityRef.current * (delta / 16.67);
          velocityRef.current *= Math.pow(0.92, delta / 16.67);
        } else {
          velocityRef.current = 0;
          offsetRef.current += (speedRef.current * delta) / 1000;
        }
      }

      if (!reducedRef.current) timeRef.current += delta;

      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      const scannerX = stageWidth / 2;
      const wrappedOffset = wrap(offsetRef.current, wrapWidthRef.current);

      track.style.transform = `translate3d(${-wrappedOffset.toFixed(2)}px, 0, 0)`;

      let nearestDistance = Number.POSITIVE_INFINITY;
      let nearestStage = "COLLECT";
      let nearestProgress = 0;

      for (const item of itemsRef.current) {
        let distance = item.left - wrappedOffset - scannerX;
        if (distance > wrapWidthRef.current / 2) distance -= wrapWidthRef.current;
        if (distance < -wrapWidthRef.current / 2) distance += wrapWidthRef.current;
        item.distance = distance;

        // The leading edge crosses the scanner first, so the wipe is measured
        // against half the card width at every viewport size.
        const halfWidth = item.width / 2;
        const progress = clamp((halfWidth - distance) / (halfWidth * 2));
        item.raw.style.clipPath = `inset(0 0 0 ${(progress * 100).toFixed(1)}%)`;
        item.structured.style.clipPath = `inset(0 ${((1 - progress) * 100).toFixed(1)}% 0 0)`;

        if (Math.abs(distance) < Math.abs(nearestDistance)) {
          nearestDistance = distance;
          nearestStage = item.stage;
          nearestProgress = progress;
        }
      }

      if (counterStageRef.current) counterStageRef.current.textContent = nearestStage;
      if (counterBarRef.current) {
        counterBarRef.current.style.transform = `scaleX(${nearestProgress.toFixed(3)})`;
      }

      draw(scannerX, wrappedOffset, stageWidth, stageHeight);
      frameRef.current = requestAnimationFrame(render);
    };

    const start = () => {
      if (frameRef.current !== null) return;
      lastFrameRef.current = performance.now();
      frameRef.current = requestAnimationFrame(render);
    };

    const stop = () => {
      if (frameRef.current === null) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };

    const resizeObserver = new ResizeObserver(() => {
      measure();
      if (visibleRef.current && frameRef.current === null) start();
    });
    resizeObserver.observe(stage);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(section);

    const onMotionChange = () => {
      reducedRef.current = motionQuery.matches;
      velocityRef.current = 0;
      if (reducedRef.current) speedRef.current = 0;
    };
    motionQuery.addEventListener("change", onMotionChange);

    onMotionChange();
    measure();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    velocityRef.current = 0;
    pointerXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = event.clientX - pointerXRef.current;
    pointerXRef.current = event.clientX;
    offsetRef.current -= delta;
    velocityRef.current = -delta / 16.67;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="scroll-mt-20 overflow-hidden bg-[#e9ebee] px-0 py-24 text-[#1b2027] sm:py-28"
      aria-labelledby="pipeline-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#a55432]">
              THE KAIROS PIPELINE
            </p>
            <h2
              id="pipeline-heading"
              className="mt-4 font-serif text-[40px] leading-[1.02] tracking-[-0.03em] sm:text-[52px] lg:text-[62px]"
            >
              From scattered information.
              <br />
              <span className="text-[#a55432]">To connected intelligence.</span>
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-[#5b6472] lg:pb-2 lg:text-[15px]">
            Bring your documents, websites, videos and knowledge together. Kairos
            transforms scattered information into a connected knowledge base you
            can explore, question and create with.
          </p>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative mt-12 h-[300px] w-full select-none sm:mt-14 sm:h-[340px] lg:h-[380px]"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => {
          hoveringRef.current = true;
        }}
        onPointerLeave={() => {
          hoveringRef.current = false;
        }}
      >
        <div
          ref={trackRef}
          className="relative flex h-full w-max items-center will-change-transform"
        >
          <PipelineGroup />
          <PipelineGroup duplicate />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-[#e9ebee] to-transparent sm:w-32"
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 z-40 w-24 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(232,102,58,0.14),transparent_70%)] blur-xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-3 bottom-[-12px] left-1/2 z-40 w-px -translate-x-1/2 bg-[#e8663a] shadow-[0_0_18px_4px_rgba(232,102,58,0.45)]"
        />

        <div className="pointer-events-none absolute left-1/2 top-3 z-50 w-44 -translate-x-1/2 rounded-full border border-[#e8663a]/25 bg-white/85 px-3 py-2 shadow-[0_8px_30px_rgba(20,27,35,0.08)] backdrop-blur-sm">
          <span className="block text-center font-mono text-[8px] uppercase tracking-[0.18em] text-[#8b94a3]">
            Knowledge processed
          </span>
          <span
            ref={counterStageRef}
            className="mt-0.5 block text-center font-mono text-[10px] font-semibold tracking-[0.16em] text-[#a55432]"
          >
            COLLECT
          </span>
          <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-[#e5e8ec]">
            <span
              ref={counterBarRef}
              className="block h-full w-full origin-left bg-[#e8663a]"
              style={{ transform: "scaleX(0)" }}
            />
          </span>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-7xl px-5 sm:px-6">
        <div className="grid gap-4 border-t border-[#d6dae0] pt-6 font-mono sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage) => (
            <div key={stage.number} className="flex gap-3">
              <span className="shrink-0 text-[#a55432]">{stage.number}</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1b2027]">
                  {stage.label}
                </p>
                <p className="mt-1 font-sans text-[12px] leading-relaxed text-[#6b7480]">
                  {stage.copy}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[#9aa3b2]">
          Illustrative visualization · no live pipeline is executed here
        </p>
      </div>
    </section>
  );
}

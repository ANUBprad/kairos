import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { runExperimentDataset } from "@/lib/experiment-engine";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import type { ExperimentConfig, ExperimentProgress } from "@/lib/experiment-engine";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`evaluation:${session.user.id}`, RATE_LIMITS.evaluation);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.evaluation) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const experimentId = typeof body.experimentId === "string" ? body.experimentId.trim() : "";
  const datasetId = typeof body.datasetId === "string" ? body.datasetId.trim() : "";
  const config = body.config as ExperimentConfig | undefined;

  if (!experimentId || !UUID_REGEX.test(experimentId)) {
    return NextResponse.json({ error: "experimentId is required and must be a valid UUID" }, { status: 400 });
  }
  if (!datasetId || !UUID_REGEX.test(datasetId)) {
    return NextResponse.json({ error: "datasetId is required and must be a valid UUID" }, { status: 400 });
  }
  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "config is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  try {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      select: { knowledgeBaseId: true, createdById: true },
    });

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    // Verify user has access to the knowledge base
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: experiment.knowledgeBaseId },
      select: {
        project: {
          select: {
            organization: {
              select: {
                members: { where: { userId: session.user.id }, select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!kb || kb.project.organization.members.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify the dataset belongs to the user's organization (or is a global
    // dataset). Without this, an authenticated user could stream benchmark
    // questions owned by another tenant.
    const dataset = await prisma.benchmarkDataset.findFirst({
      where: {
        id: datasetId,
        OR: [
          { knowledgeBaseId: null },
          {
            knowledgeBase: {
              project: {
                organization: {
                  members: { some: { userId: session.user.id } },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: ExperimentProgress) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await runExperimentDataset(
            experimentId,
            experiment.knowledgeBaseId,
            config,
            datasetId,
            send,
          );

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          send({
            type: "error",
            questionIndex: 0,
            totalQuestions: 0,
            query: "",
            error: err instanceof Error ? err.message : "Unknown error",
            timestamp: Date.now(),
          });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

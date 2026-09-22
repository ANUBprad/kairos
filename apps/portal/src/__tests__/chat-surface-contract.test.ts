// Chat-surface contract: guards the "one canonical chat experience" invariant
// for F4. The canonical surface is /api/ai/chat consumed only by
// chat-interface.tsx, mounted at /app/knowledge-bases/[kbId]/chat. Legacy
// surfaces (/app/rag-chat, /app/copilot, /api/copilot, lib/copilot) are
// retired; the two redirect shells exist only to keep old bookmarks alive.
// This test fails when a duplicate chat API, an orphaned copilot backend, or a
// stale /app/rag-chat link is reintroduced.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");
const APP = join(SRC, "app");

describe("single canonical chat surface contract", () => {
  it("keeps /api/ai/chat and the per-KB chat page as the only chat surfaces", () => {
    assert.ok(existsSync(join(APP, "api/ai/chat/route.ts")), "canonical chat API must exist");
    assert.ok(
      existsSync(join(APP, "app/knowledge-bases/[kbId]/chat/page.tsx")),
      "canonical chat page must exist",
    );
    assert.ok(!existsSync(join(APP, "api/copilot")), "orphaned /api/copilot must not exist");
    assert.ok(!existsSync(join(SRC, "lib/copilot")), "orphaned lib/copilot must not exist");
  });

  it("allows no duplicate chat API routes outside /api/ai/*", () => {
    const apiDirs = ["api/chat", "api/rag-chat", "api/ask", "api/conversation"];
    for (const dir of apiDirs) {
      assert.ok(!existsSync(join(APP, dir)), `duplicate chat route ${dir} must not exist`);
    }
  });

  it("routes the legacy shells to the knowledge bases landing", () => {
    for (const page of [
      join(APP, "app/rag-chat/page.tsx"),
      join(APP, "app/copilot/page.tsx"),
    ]) {
      assert.ok(existsSync(page), `${page} redirect shell must exist`);
      const source = readFileSync(page, "utf8");
      assert.match(source, /redirect\("\/app\/knowledge-bases"\)/);
    }
  });

  it("has no stale /app/rag-chat references anywhere in app source", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "__tests__") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (readFileSync(full, "utf8").includes("/app/rag-chat")) {
            offenders.push(full.replace(SRC, "").replace(/^\\/, ""));
          }
        }
      }
    };
    walk(SRC);
    assert.deepEqual(offenders, []);
  });

  it("keeps chat-interface.tsx as the sole consumer of the canonical chat API", () => {
    const consumers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "__tests__") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = readFileSync(full, "utf8");
          if (source.includes('fetch("/api/ai/chat"') || source.includes("fetch(`/api/ai/chat")) {
            consumers.push(entry.name);
          }
        }
      }
    };
    walk(SRC);
    assert.deepEqual(consumers, ["chat-interface.tsx"], "only the shared chat component may call /api/ai/chat");
  });

  it("fails fast on non-streaming chat responses before allocating the SSE reader", () => {
    const source = readFileSync(join(SRC, "components/app/chat-interface.tsx"), "utf8");
    assert.match(source, /import \{ resolveStreamGate \} from "@\/lib\/ai\/chat\/stream-gate"/);
    const gateCall = source.indexOf("resolveStreamGate(res)");
    const readerCall = source.indexOf("res.body?.getReader()");
    assert.ok(gateCall > -1, "chat-interface must invoke resolveStreamGate");
    assert.ok(readerCall > -1, "chat-interface must still read the SSE stream");
    assert.ok(
      gateCall < readerCall,
      "resolveStreamGate must run before the SSE reader is allocated",
    );
  });

  it("rate-limits conversation list/read and write routes", () => {
    const listSource = readFileSync(join(APP, "api/ai/conversations/route.ts"), "utf8");
    assert.match(
      listSource,
      /rateLimit\(`conversation:read:\$\{session\.user\.id\}`, RATE_LIMITS\.conversation\)/,
      "conversation list GET must be rate-limited",
    );

    const idSource = readFileSync(join(APP, "api/ai/conversations/[id]/route.ts"), "utf8");
    assert.match(
      idSource,
      /rateLimit\(`conversation:read:\$\{session\.user\.id\}`, RATE_LIMITS\.conversation\)/,
      "conversation [id] GET must be rate-limited",
    );
    const writeMatches = idSource.match(
      /rateLimit\(`conversation:write:\$\{session\.user\.id\}`, RATE_LIMITS\.conversation\)/g,
    );
    assert.equal(
      writeMatches?.length ?? 0,
      2,
      "conversation [id] DELETE and PATCH must each be rate-limited",
    );
  });
});
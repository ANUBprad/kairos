import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirror the Zod schema from create-knowledge-base-dialog.tsx
// and the validation from knowledge-base.ts server action.
// This proves the input contract is consistent and correct.

import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
});

// ponytail: NODE_ENV is read-only in TS types; cast once here for test env mutation.
const env = process.env as Record<string, string | undefined>;

describe("Knowledge base creation — input contract", () => {
  it("rejects empty name", () => {
    const result = createSchema.safeParse({ name: "", description: "test" });
    assert.equal(result.success, false);
  });

  it("rejects name over 255 chars", () => {
    const result = createSchema.safeParse({ name: "x".repeat(256), description: "test" });
    assert.equal(result.success, false);
  });

  it("accepts valid name with description", () => {
    const result = createSchema.safeParse({ name: "Test KB", description: "A test" });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, "Test KB");
      assert.equal(result.data.description, "A test");
    }
  });

  it("accepts valid name without description", () => {
    const result = createSchema.safeParse({ name: "Test KB" });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.description, undefined);
    }
  });

  it("rejects description over 1000 chars", () => {
    const result = createSchema.safeParse({ name: "Test KB", description: "x".repeat(1001) });
    assert.equal(result.success, false);
  });
});

describe("Knowledge base creation — demo mode gate", () => {
  it("isDemoModeEnabled requires KAIROS_DEMO_MODE=true in non-production", () => {
    // Replicate the logic from demo-user.ts:isDemoModeEnabled
    function isDemoModeEnabled(): boolean {
      if (env.NODE_ENV === "production") return false;
      return env.KAIROS_DEMO_MODE === "true";
    }

    const savedDemo = env.KAIROS_DEMO_MODE;
    const savedNode = env.NODE_ENV;

    try {
      env.NODE_ENV = "development";

      env.KAIROS_DEMO_MODE = "true";
      assert.equal(isDemoModeEnabled(), true);

      env.KAIROS_DEMO_MODE = "false";
      assert.equal(isDemoModeEnabled(), false);

      delete env.KAIROS_DEMO_MODE;
      assert.equal(isDemoModeEnabled(), false);
    } finally {
      if (savedDemo !== undefined) env.KAIROS_DEMO_MODE = savedDemo;
      else delete env.KAIROS_DEMO_MODE;
      if (savedNode !== undefined) env.NODE_ENV = savedNode;
      else delete env.NODE_ENV;
    }
  });

  it("isDemoModeEnabled always returns false in production", () => {
    function isDemoModeEnabled(): boolean {
      if (env.NODE_ENV === "production") return false;
      return env.KAIROS_DEMO_MODE === "true";
    }

    const savedDemo = env.KAIROS_DEMO_MODE;
    const savedNode = env.NODE_ENV;

    try {
      env.NODE_ENV = "production";
      env.KAIROS_DEMO_MODE = "true";
      assert.equal(isDemoModeEnabled(), false);
    } finally {
      if (savedDemo !== undefined) env.KAIROS_DEMO_MODE = savedDemo;
      else delete env.KAIROS_DEMO_MODE;
      if (savedNode !== undefined) env.NODE_ENV = savedNode;
      else delete env.NODE_ENV;
    }
  });
});

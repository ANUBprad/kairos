import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("./cinematic-pipeline.tsx", import.meta.url)),
  "utf8",
);

test("conveyor uses the approved moderate speed and a noticeable hover slowdown", () => {
  assert.match(source, /const BASE_SPEED = 46;/);
  assert.match(source, /const HOVER_SPEED = 15;/);
  assert.match(source, /useRef\(BASE_SPEED\)/);
  assert.match(source, /hoveringRef\.current\s*\?\s*HOVER_SPEED\s*:\s*BASE_SPEED/);
  assert.doesNotMatch(source, /speedRef\s*=\s*useRef\(34\)/);
  assert.doesNotMatch(source, /0\.075/);
});

test("conveyor movement and easing remain frame-rate independent", () => {
  assert.match(source, /\(speedRef\.current \* delta\) \/ 1000/);
  assert.match(source, /Math\.pow\(0\.92, delta \/ 16\.67\)/);
});

test("particle rendering reads the shared processing tokens", () => {
  assert.match(source, /channelToken\(styles, "--processing-rgb"\)/);
  assert.match(source, /channelToken\(styles, "--processing-deep-rgb"\)/);
  assert.match(source, /channelToken\(styles, "--spark-rgb"\)/);
  assert.match(source, /const RAW_PARTICLES = 22;/);
  assert.match(source, /const SPARK_PARTICLES = 5;/);
});

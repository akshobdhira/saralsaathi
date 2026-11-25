import { test, expect } from "@playwright/test";
import { analyseFrame } from "../components/input/framing";

// Pure-function check of the camera framing heuristics (no browser needed).
const W = 80, H = 60;
const frame = (f: (x: number, y: number) => number) =>
  Uint8Array.from({ length: W * H }, (_, i) => f(i % W, Math.floor(i / W)));

test("framing hints", () => {
  expect(analyseFrame(frame(() => 20), W, H)).toBe("dark");
  expect(analyseFrame(frame(() => 180), W, H)).toBe("blurry");
  // Text-like stripes only in the centre → good.
  const inCentre = (x: number, y: number) => x > 15 && x < 65 && y > 12 && y < 48;
  expect(analyseFrame(frame((x, y) => (inCentre(x, y) && x % 3 === 0 ? 30 : 220)), W, H)).toBe("good");
  // Stripes everywhere (page runs off the edges) → move back.
  expect(analyseFrame(frame((x) => (x % 3 === 0 ? 30 : 220)), W, H)).toBe("back");
  // A tiny patch of text → move closer.
  expect(analyseFrame(frame((x, y) => (x > 38 && x < 42 && y > 28 && y < 32 && x % 2 ? 30 : 200)), W, H)).toBe("closer");
});

import { describe, expect, it } from "vitest";
import { createQuietTracker } from "./quiet-tracker";

describe("quiet tracker", () => {
  it("restarts the clock whenever the visible screen changes", () => {
    const t = createQuietTracker();
    expect(t.observe("a", 1000)).toBe(0);
    expect(t.observe("a", 1600)).toBe(600);
    expect(t.observe("b", 2000)).toBe(0);
    expect(t.observe("b", 3700)).toBe(1700);
  });

  it("is not reset by observing the same screen again and again", () => {
    // An agent that re-sends invisible bytes every second leaves the
    // signature unchanged — the screen still counts as quiet.
    const t = createQuietTracker();
    t.observe("idle", 0);
    let quiet = 0;
    for (let now = 250; now <= 5000; now += 250) quiet = t.observe("idle", now);
    expect(quiet).toBe(5000);
  });

  it("starts conservatively: the first observation is not yet quiet", () => {
    expect(createQuietTracker().observe("x", 123456)).toBe(0);
  });
});

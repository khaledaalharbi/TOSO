import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@/lib/types";
import { SettingsModal, statusFromKeySignal } from "./settings-modal";

const config = (userKey?: string): ProviderConfig => ({
  provider: "google",
  model: "gemini-3.8-flash",
  userKey,
});

const render = (
  cfg: ProviderConfig,
  keySignal: { key: string; signal: string } | null = null,
) =>
  renderToStaticMarkup(
    <SettingsModal
      open={true}
      onClose={() => {}}
      config={cfg}
      onChange={() => {}}
      keySignal={keySignal}
    />,
  );

describe("statusFromKeySignal", () => {
  it("maps signals honestly without inventing health", () => {
    expect(statusFromKeySignal("ok")).toBe("ok");
    expect(statusFromKeySignal("user_key_quota")).toBe("quota");
    expect(statusFromKeySignal("user_key_invalid")).toBe("invalid");
    expect(statusFromKeySignal("user_key_http_500")).toBe("invalid");
    expect(statusFromKeySignal("http_500")).toBe("unreachable");
    expect(statusFromKeySignal("unreachable")).toBe("unreachable");
    expect(statusFromKeySignal(null)).toBe("idle");
    expect(statusFromKeySignal(undefined)).toBe("idle");
  });
});

describe("SettingsModal key status", () => {
  it("shows a gray idle dot and a verify button for an unchecked saved key", () => {
    const markup = render(config("AQ.userkey1234"));
    expect(markup).toContain("bg-slate-300");
    expect(markup).toContain("تحقق");
    expect(markup).toContain("••••1234");
    expect(markup).not.toContain("رفض هذا المفتاح");
  });

  it("shows the quota state when the last run drained the same key", () => {
    const markup = render(config("AQ.userkey1234"), {
      key: "AQ.userkey1234",
      signal: "user_key_quota",
    });
    expect(markup).toContain("bg-amber-500");
    expect(markup).toContain("حصة مفتاحك مستنزفة");
  });

  it("shows the invalid state for a rejected user key", () => {
    const markup = render(config("AQ.userkey1234"), {
      key: "AQ.userkey1234",
      signal: "user_key_invalid",
    });
    expect(markup).toContain("bg-rose-500");
    expect(markup).toContain("رفض هذا المفتاح");
  });

  it("shows green when the same key actually served a run", () => {
    const markup = render(config("AQ.userkey1234"), {
      key: "AQ.userkey1234",
      signal: "ok",
    });
    expect(markup).toContain("bg-emerald-500");
    expect(markup).toContain("تحقّقت Google من المفتاح");
  });

  it("ignores a signal bound to a different key value", () => {
    const markup = render(config("AQ.newkey9999"), {
      key: "AQ.oldkey0000",
      signal: "user_key_invalid",
    });
    expect(markup).toContain("bg-slate-300");
    expect(markup).not.toContain("رفض هذا المفتاح");
  });

  it("hides the status block entirely without a saved key", () => {
    const markup = render(config());
    expect(markup).not.toContain("تحقق");
    expect(markup).not.toContain("مفتاح محفوظ");
  });

  it("mentions the AQ. prefix hint inside the guide", () => {
    expect(render(config())).toContain("AQ.");
  });
});

import { describe, expect, it } from "vitest";
import { buildJoinUrl, resolveJoinLink } from "./joinLink";

describe("resolveJoinLink", () => {
  it("reads the code and role out of a deep link", () => {
    expect(resolveJoinLink("abc123", "client")).toEqual({ code: "abc123", role: "client" });
    expect(resolveJoinLink("abc123", "observer")).toEqual({ code: "abc123", role: "observer" });
  });

  it("ignores a link without a code", () => {
    expect(resolveJoinLink(null, "client")).toBeNull();
    expect(resolveJoinLink(undefined, "observer")).toBeNull();
    expect(resolveJoinLink("", "observer")).toBeNull();
  });

  it("defaults a missing or unknown role to client", () => {
    expect(resolveJoinLink("abc123", null)).toEqual({ code: "abc123", role: "client" });
    expect(resolveJoinLink("abc123", "server")).toEqual({ code: "abc123", role: "client" });
  });
});

describe("buildJoinUrl", () => {
  it("adds the code and role to the current page", () => {
    expect(buildJoinUrl("https://example.com/", "abc123", "observer"))
      .toBe("https://example.com/?code=abc123&role=observer");
  });

  it("preserves unrelated query parameters", () => {
    const url = buildJoinUrl("https://example.com/?locale=ja&r2", "abc123", "client");
    expect(url).toContain("locale=ja");
    expect(url).toContain("code=abc123");
    expect(url).toContain("role=client");
  });

  it("overwrites a stale code and role", () => {
    const url = buildJoinUrl("https://example.com/?code=old&role=observer", "new", "client");
    expect(url).not.toContain("code=old");
    expect(url).not.toContain("role=observer");
    expect(url).toContain("code=new");
    expect(url).toContain("role=client");
  });
});

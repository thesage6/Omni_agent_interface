// Unit tests for URL recovery from pane captures (links.ts).
import { describe, expect, test } from "bun:test";
import { detectUrls, osc8Urls, reconstructUrls } from "./links.ts";

describe("osc8Urls", () => {
  test("extracts hyperlink targets from OSC 8 sequences (BEL and ST terminated)", () => {
    const escaped =
      "\x1b]8;;https://example.com/a\x07label\x1b]8;;\x07 and " +
      "\x1b]8;;https://example.com/b\x1b\\other\x1b]8;;\x1b\\";
    expect(osc8Urls(escaped)).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  test("ignores non-http targets and strips trailing punctuation", () => {
    const escaped = "\x1b]8;;file:///etc/hosts\x07x\x1b]8;;\x07\x1b]8;;https://x.co/y.\x07x\x1b]8;;\x07";
    expect(osc8Urls(escaped)).toEqual(["https://x.co/y"]);
  });
});

describe("reconstructUrls", () => {
  test("finds a simple URL and strips trailing punctuation", () => {
    expect(reconstructUrls("Visit https://x.co/y.", 80)).toEqual(["https://x.co/y"]);
  });

  test("joins a URL wrapped across full-width rows", () => {
    // Width 10: the first row's URL run reaches the last column, so the next
    // row's leading URL run is a continuation.
    const plain = ["https://ab", "cd rest"].join("\n");
    expect(reconstructUrls(plain, 10)).toEqual(["https://abcd"]);
  });

  test("does not join when the row stops short of the pane edge", () => {
    const plain = ["https://ab", "cd rest"].join("\n");
    // Same rows, wider pane: the first row no longer touches the edge.
    expect(reconstructUrls(plain, 20)).toEqual(["https://ab"]);
  });

  test("stops joining when the next row does not start with URL chars", () => {
    const plain = ["https://ab", " indented"].join("\n");
    expect(reconstructUrls(plain, 10)).toEqual(["https://ab"]);
  });
});

describe("detectUrls", () => {
  test("prefers OSC 8, de-duplicates, and drops strict-prefix fragments", () => {
    const urls = detectUrls({
      plain: "see https://example.com/long and https://example.com/long/path",
      escaped: "\x1b]8;;https://example.com/long/path\x07x\x1b]8;;\x07",
      width: 120,
    });
    // The bare /long is a strict prefix of /long/path → treated as a
    // truncated-wrap artifact and dropped; the full URL survives once.
    expect(urls).toEqual(["https://example.com/long/path"]);
  });
});

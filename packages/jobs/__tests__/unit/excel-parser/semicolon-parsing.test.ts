/**
 * Unit Tests: Excel Parser - Semicolon Parsing
 *
 * Tests parsing of semicolon-separated fields (Tags, Eco Claims, Materials).
 *
 * @group unit
 * @group excel-parser
 */

import { describe, expect, it } from "bun:test";
import { parseSemicolonSeparated } from "../../../src/lib/excel-parser";

describe("Excel Parser - Semicolon Parsing", () => {
  it("parses single value", () => {
    const result = parseSemicolonSeparated("tag1");
    expect(result).toEqual(["tag1"]);
  });

  it("parses multiple values", () => {
    const result = parseSemicolonSeparated("tag1;tag2;tag3");
    expect(result).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("trims whitespace around values", () => {
    const result = parseSemicolonSeparated(" tag1 ; tag2 ");
    expect(result).toEqual(["tag1", "tag2"]);
  });

  it("handles empty string", () => {
    const result = parseSemicolonSeparated("");
    expect(result).toEqual([]);
  });

  it("filters out empty values", () => {
    const result = parseSemicolonSeparated("tag1;;tag2");
    expect(result).toEqual(["tag1", "tag2"]);
  });

  it("handles leading/trailing semicolons", () => {
    const result = parseSemicolonSeparated(";tag1;tag2;");
    expect(result).toEqual(["tag1", "tag2"]);
  });

  it("preserves special characters", () => {
    // Semicolons separate values, but other special characters should be preserved
    const result = parseSemicolonSeparated(
      "tag;with:colon;and@symbol;plus+sign",
    );
    expect(result).toEqual(["tag", "with:colon", "and@symbol", "plus+sign"]);
  });

  it("handles undefined", () => {
    const result = parseSemicolonSeparated(undefined);
    expect(result).toEqual([]);
  });

  it("handles whitespace-only string", () => {
    const result = parseSemicolonSeparated("   ");
    expect(result).toEqual([]);
  });

  it("handles values with internal whitespace", () => {
    const result = parseSemicolonSeparated(
      "New York; Los Angeles; San Francisco",
    );
    expect(result).toEqual(["New York", "Los Angeles", "San Francisco"]);
  });
});

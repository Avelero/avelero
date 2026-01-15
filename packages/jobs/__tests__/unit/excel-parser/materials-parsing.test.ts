/**
 * Unit Tests: Excel Parser - Materials Parsing
 *
 * Tests the materials parsing from "Materials" and "Percentages" columns.
 * Materials are semicolon-separated names, percentages are semicolon-separated values.
 *
 * @group unit
 * @group excel-parser
 */

import { describe, expect, it } from "bun:test";
import { parseMaterials } from "../../../src/lib/excel";

describe("Excel Parser - Materials Parsing", () => {
  it("parses single material with percentage", () => {
    const result = parseMaterials("Cotton", "100");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Cotton");
    expect(result[0]!.percentage).toBe(100);
  });

  it("parses minimal material (name only, no percentage)", () => {
    const result = parseMaterials("Cotton");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Cotton");
    expect(result[0]!.percentage).toBeUndefined();
  });

  it("parses multiple materials with percentages", () => {
    const result = parseMaterials("Cotton; Polyester; Elastane", "80; 15; 5");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "Cotton", percentage: 80 });
    expect(result[1]).toEqual({ name: "Polyester", percentage: 15 });
    expect(result[2]).toEqual({ name: "Elastane", percentage: 5 });
  });

  it("handles more materials than percentages", () => {
    // When there are more materials than percentages, extra materials have no percentage
    const result = parseMaterials("Cotton; Polyester; Elastane", "80; 15");

    expect(result).toHaveLength(3);
    expect(result[0]!.percentage).toBe(80);
    expect(result[1]!.percentage).toBe(15);
    expect(result[2]!.percentage).toBeUndefined();
  });

  it("handles more percentages than materials", () => {
    // Extra percentages are ignored
    const result = parseMaterials("Cotton; Polyester", "80; 15; 5");

    expect(result).toHaveLength(2);
    expect(result[0]!.percentage).toBe(80);
    expect(result[1]!.percentage).toBe(15);
  });

  it("handles non-numeric percentage values", () => {
    // Non-numeric values should result in undefined percentage
    const result = parseMaterials("Cotton; Polyester", "eighty; 15");

    expect(result).toHaveLength(2);
    expect(result[0]!.percentage).toBeUndefined(); // "eighty" is not numeric
    expect(result[1]!.percentage).toBe(15);
  });

  it("handles decimal percentage values", () => {
    const result = parseMaterials("Cotton; Elastane", "95.5; 4.5");

    expect(result).toHaveLength(2);
    expect(result[0]!.percentage).toBe(95.5);
    expect(result[1]!.percentage).toBe(4.5);
  });

  it("handles empty materials value", () => {
    const result = parseMaterials("", "80; 20");

    expect(result).toEqual([]);
  });

  it("handles undefined materials value", () => {
    const result = parseMaterials(undefined, "80; 20");

    expect(result).toEqual([]);
  });

  it("handles empty percentages value", () => {
    const result = parseMaterials("Cotton; Polyester", "");

    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Cotton");
    expect(result[0]!.percentage).toBeUndefined();
    expect(result[1]!.name).toBe("Polyester");
    expect(result[1]!.percentage).toBeUndefined();
  });

  it("handles undefined percentages value", () => {
    const result = parseMaterials("Cotton; Polyester", undefined);

    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Cotton");
    expect(result[0]!.percentage).toBeUndefined();
    expect(result[1]!.name).toBe("Polyester");
    expect(result[1]!.percentage).toBeUndefined();
  });

  it("trims whitespace from material names", () => {
    const result = parseMaterials("  Cotton  ;  Polyester  ", "80; 20");

    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Cotton");
    expect(result[1]!.name).toBe("Polyester");
  });

  it("handles percentage values with whitespace", () => {
    const result = parseMaterials("Cotton; Polyester", "  80  ;  20  ");

    expect(result).toHaveLength(2);
    expect(result[0]!.percentage).toBe(80);
    expect(result[1]!.percentage).toBe(20);
  });

  it("handles zero percentage", () => {
    const result = parseMaterials("Cotton", "0");

    expect(result).toHaveLength(1);
    expect(result[0]!.percentage).toBe(0);
  });

  it("handles percentage over 100", () => {
    // The parser doesn't validate percentage range, that's for the validator
    const result = parseMaterials("Cotton", "150");

    expect(result).toHaveLength(1);
    expect(result[0]!.percentage).toBe(150);
  });

  it("handles negative percentage", () => {
    // The parser doesn't validate percentage range, that's for the validator
    const result = parseMaterials("Cotton", "-10");

    expect(result).toHaveLength(1);
    expect(result[0]!.percentage).toBe(-10);
  });
});

import { describe, it, expect } from "vitest";
import { emptyToNull, escapeRegex } from "@/lib/forms";

describe("emptyToNull", () => {
  it("returns null for null input", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(emptyToNull("   ")).toBeNull();
  });

  it("trims and returns non-empty strings", () => {
    expect(emptyToNull("  hello  ")).toBe("hello");
  });

  it("stringifies non-string FormDataEntryValue", () => {
    const file = new File(["content"], "name.txt");
    expect(emptyToNull(file)).toBe(file.toString());
  });
});

describe("escapeRegex", () => {
  it("escapes regex special characters", () => {
    expect(escapeRegex("a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o")).toBe(
      "a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o"
    );
  });

  it("leaves plain strings unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});

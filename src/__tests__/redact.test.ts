import { describe, it, expect } from "vitest";

import { findTokens, redactTokens } from "../redact";

describe("findTokens", () => {
  it("extracts a token from an anaconda.org channel URL", () => {
    expect(
      findTokens("https://conda.anaconda.org/t/tk-abc-123/my-channel"),
    ).toEqual(["tk-abc-123"]);
  });

  it("finds multiple tokens", () => {
    const text =
      "https://conda.anaconda.org/t/tok1/a\nhttps://conda.anaconda.org/t/tok2/b";
    expect(findTokens(text)).toEqual(["tok1", "tok2"]);
  });

  it("returns an empty array when there is no token", () => {
    expect(findTokens("https://conda.anaconda.org/conda-forge")).toEqual([]);
  });
});

describe("redactTokens", () => {
  it("replaces the token segment with ***", () => {
    expect(
      redactTokens("https://conda.anaconda.org/t/tk-abc-123/my-channel"),
    ).toBe("https://conda.anaconda.org/t/***/my-channel");
  });

  it("redacts a token with no trailing channel", () => {
    expect(redactTokens("https://conda.anaconda.org/t/tk-abc-123")).toBe(
      "https://conda.anaconda.org/t/***",
    );
  });

  it("leaves token-free text untouched", () => {
    const text = "channels:\n  - conda-forge\n  - defaults";
    expect(redactTokens(text)).toBe(text);
  });

  it("redacts tokens inside a multi-line condarc dump", () => {
    const dump = "channels:\n  - https://conda.anaconda.org/t/sekret/private\n";
    expect(redactTokens(dump)).not.toContain("sekret");
    expect(redactTokens(dump)).toContain("/t/***/private");
  });
});

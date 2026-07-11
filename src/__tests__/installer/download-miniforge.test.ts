import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { makeActionInputs } from "../helpers";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

const mockEnsureLocalInstaller = vi.fn();
vi.mock("../../installer/base", () => ({
  ensureLocalInstaller: (...args: any[]) => mockEnsureLocalInstaller(...args),
}));

// We need to control IS_UNIX and OS_NAMES per-test
let mockIsUnix = true;

vi.mock("../../constants", () => ({
  get IS_UNIX() {
    return mockIsUnix;
  },
  get OS_NAMES() {
    return { linux: "Linux", darwin: "MacOSX", win32: "Windows" };
  },
  MINIFORGE_ARCHITECTURES: {
    x64: "x86_64",
    x86_64: "x86_64",
    aarch64: "aarch64",
    ppc64le: "ppc64le",
    arm64: "arm64",
  },
  MINIFORGE_URL_PREFIX: "https://github.com/conda-forge/miniforge/releases",
  MINIFORGE_DEFAULT_VARIANT: "Miniforge3",
  MINIFORGE_DEFAULT_VERSION: "latest",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return makeActionInputs(overrides);
}

function makeOptions(
  overrides: Partial<types.IDynamicOptions> = {},
): types.IDynamicOptions {
  return {
    useBundled: false,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("miniforgeDownloader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUnix = true;
  });

  describe("provides()", () => {
    it("returns true when miniforgeVersion is set", async () => {
      const { miniforgeDownloader } =
        await import("../../installer/download-miniforge");
      const inputs = makeInputs({ miniforgeVersion: "4.9.2-5" });
      const result = await miniforgeDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns true when miniforgeVariant is set", async () => {
      const { miniforgeDownloader } =
        await import("../../installer/download-miniforge");
      const inputs = makeInputs({ miniforgeVariant: "Mambaforge" });
      const result = await miniforgeDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns true when both miniforgeVersion and miniforgeVariant are set", async () => {
      const { miniforgeDownloader } =
        await import("../../installer/download-miniforge");
      const inputs = makeInputs({
        miniforgeVersion: "4.9.2-5",
        miniforgeVariant: "Mambaforge",
      });
      const result = await miniforgeDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns false when neither miniforgeVersion nor miniforgeVariant is set", async () => {
      const { miniforgeDownloader } =
        await import("../../installer/download-miniforge");
      const inputs = makeInputs({
        miniforgeVersion: "",
        miniforgeVariant: "",
      });
      const result = await miniforgeDownloader.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });
  });

  describe("installerPath()", () => {
    it("sets useBundled to false in returned options", async () => {
      mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.sh");
      const { miniforgeDownloader } =
        await import("../../installer/download-miniforge");
      const inputs = makeInputs({ miniforgeVersion: "latest" });
      const result = await miniforgeDownloader.installerPath(
        inputs,
        makeOptions({ useBundled: true }),
      );
      expect(result.options.useBundled).toBe(false);
      expect(result.localInstallerPath).toBe("/tmp/miniforge.sh");
    });
  });
});

describe("downloadMiniforge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUnix = true;
  });

  it("constructs a latest URL with default variant when only version=latest", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.sh");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "latest",
      miniforgeVariant: "",
      architecture: "x64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/latest/download/Miniforge3-"),
        tool: "Miniforge3",
        version: "latest",
        arch: "x86_64",
      }),
    );
  });

  it("constructs a versioned URL when version is not latest", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.sh");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "4.9.2-5",
      miniforgeVariant: "",
      architecture: "x64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/download/4.9.2-5/Miniforge3-4.9.2-5-"),
        tool: "Miniforge3",
        version: "4.9.2-5",
        arch: "x86_64",
      }),
    );
  });

  it("uses the provided miniforgeVariant", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/mambaforge.sh");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "latest",
      miniforgeVariant: "Mambaforge",
      architecture: "x64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("Mambaforge-"),
        tool: "Mambaforge",
      }),
    );
  });

  it("defaults variant to Miniforge3 and version to latest when both empty", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.sh");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "",
      miniforgeVariant: "",
      architecture: "x64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "Miniforge3",
        version: "latest",
      }),
    );
  });

  it("maps arm64 architecture correctly", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.sh");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "latest",
      architecture: "arm64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        arch: "arm64",
      }),
    );
  });

  it("throws for an invalid architecture", async () => {
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "latest",
      architecture: "sparc",
    });

    await expect(downloadMiniforge(inputs, makeOptions())).rejects.toThrow(
      /Invalid.*architecture/i,
    );
  });

  it("uses .exe extension on Windows", async () => {
    mockIsUnix = false;
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniforge.exe");
    const { downloadMiniforge } =
      await import("../../installer/download-miniforge");
    const inputs = makeInputs({
      miniforgeVersion: "latest",
      architecture: "x64",
    });

    await downloadMiniforge(inputs, makeOptions());

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(".exe"),
      }),
    );
  });
});

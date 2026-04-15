import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// OS name used in miniconda installer filenames
const OS_NAME_MAP: Record<string, string> = {
  linux: "Linux",
  darwin: "MacOSX",
  win32: "Windows",
};
const osName = OS_NAME_MAP[process.platform] ?? "Linux";

const mockEnsureLocalInstaller = vi.fn();
vi.mock("../../installer/base", () => ({
  ensureLocalInstaller: (...args: any[]) => mockEnsureLocalInstaller(...args),
}));

let mockIsUnix = true;
vi.mock("../../constants", () => ({
  get IS_UNIX() {
    return mockIsUnix;
  },
  get OS_NAMES() {
    return { linux: "Linux", darwin: "MacOSX", win32: "Windows" };
  },
  MINICONDA_BASE_URL: "https://repo.anaconda.com/miniconda/",
  MINICONDA_ARCHITECTURES: {
    aarch64: "aarch64",
    arm64: "arm64",
    ppc64le: "ppc64le",
    s390x: "s390x",
    x64: "x86_64",
    x86_64: "x86_64",
    x86: "x86",
    arm32: "armv7l",
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return Object.freeze({
    activateEnvironment: "test",
    architecture: "x64",
    condaBuildVersion: "",
    condaConfigFile: "",
    condaVersion: "",
    environmentFile: "",
    installerUrl: "",
    installationDir: "",
    mambaVersion: "",
    minicondaVersion: "",
    miniforgeVariant: "",
    miniforgeVersion: "",
    condaRemoveDefaults: "false",
    pythonVersion: "",
    removeProfiles: "true",
    runInit: "true",
    useMamba: "",
    cleanPatchedEnvironmentFile: "true",
    runPost: "true",
    condaConfig: Object.freeze({
      add_anaconda_token: "",
      add_pip_as_python_dependency: "",
      allow_softlinks: "",
      auto_activate: "false",
      auto_update_conda: "false",
      channel_alias: "",
      channel_priority: "",
      channels: "",
      default_activation_env: "",
      show_channel_urls: "",
      use_only_tar_bz2: "",
      always_yes: "true",
      changeps1: "false",
      solver: "",
      pkgs_dirs: "",
    }),
    ...overrides,
  }) as types.IActionInputs;
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

describe("minicondaDownloader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsUnix = true;
  });

  describe("provides()", () => {
    it("returns true when installerUrl is empty (fallback provider)", async () => {
      const { minicondaDownloader } =
        await import("../../installer/download-miniconda");
      const inputs = makeInputs({ installerUrl: "" });
      const result = await minicondaDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns false when installerUrl is set", async () => {
      const { minicondaDownloader } =
        await import("../../installer/download-miniconda");
      const inputs = makeInputs({
        installerUrl: "https://example.com/custom.sh",
      });
      const result = await minicondaDownloader.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });
  });

  describe("installerPath()", () => {
    it("calls downloadMiniconda with pythonMajorVersion=3 and sets useBundled=false", async () => {
      mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
      const { minicondaDownloader } =
        await import("../../installer/download-miniconda");
      const inputs = makeInputs({ minicondaVersion: "latest" });
      const result = await minicondaDownloader.installerPath(
        inputs,
        makeOptions({ useBundled: true }),
      );
      expect(result.options.useBundled).toBe(false);
      expect(result.localInstallerPath).toBe("/tmp/miniconda.sh");
    });
  });
});

describe("downloadMiniconda", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsUnix = true;
  });

  it("constructs the correct installer name and URL for a known version", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({
      minicondaVersion: "latest",
      architecture: "x64",
    });

    await downloadMiniconda(3, inputs);

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith({
      url: `https://repo.anaconda.com/miniconda/Miniconda3-latest-${osName}-x86_64.sh`,
      tool: "Miniconda3",
      version: "latest",
      arch: "x86_64",
    });
  });

  it("throws for an invalid architecture", async () => {
    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({ architecture: "sparc" });

    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(/Invalid arch/i);
  });

  it("wraps ensureLocalInstaller errors with a descriptive message", async () => {
    mockEnsureLocalInstaller.mockRejectedValue(new Error("HTTP 404"));

    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({
      minicondaVersion: "nonexistent-version",
      architecture: "x64",
    });

    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(
      /Failed to download Miniconda installer/i,
    );
  });

  it("includes the version and platform in the error message", async () => {
    mockEnsureLocalInstaller.mockRejectedValue(new Error("HTTP 404"));

    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({
      minicondaVersion: "bad-version",
      architecture: "x64",
    });

    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(/bad-version/);
  });

  it("maps architecture names through MINICONDA_ARCHITECTURES", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({
      minicondaVersion: "latest",
      architecture: "aarch64",
    });

    await downloadMiniconda(3, inputs);

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        arch: "aarch64",
      }),
    );
  });

  it("defaults minicondaVersion to 'latest' when empty", async () => {
    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } =
      await import("../../installer/download-miniconda");
    const inputs = makeInputs({
      minicondaVersion: "",
      architecture: "x64",
    });

    await downloadMiniconda(3, inputs);

    expect(mockEnsureLocalInstaller).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "latest",
        url: expect.stringContaining(`Miniconda3-latest-${osName}-`),
      }),
    );
  });
});

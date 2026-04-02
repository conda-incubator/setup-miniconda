import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@actions/tool-cache", () => ({
  downloadTool: vi.fn(async () => "/tmp/miniconda-index"),
  find: vi.fn(() => ""),
  cacheFile: vi.fn(async () => "/tmp/cached"),
}));

// OS name used in miniconda installer filenames
const OS_NAME_MAP: Record<string, string> = {
  linux: "Linux",
  darwin: "MacOSX",
  win32: "Windows",
};
const osName = OS_NAME_MAP[process.platform] ?? "Linux";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(
      () =>
        `<a href="/Miniconda3-latest-${osName}-x86_64.sh">link</a>` +
        `<a href="/Miniconda3-py39_4.12.0-${osName}-x86_64.sh">link</a>` +
        `<a href="/Miniconda3-latest-${osName}-aarch64.sh">link</a>`,
    ),
  };
});

vi.mock("get-hrefs", () => ({
  default: vi.fn((content: string) => {
    // Simple extraction for test purposes
    const matches = content.match(/href="([^"]+)"/g) || [];
    return matches.map((m: string) => m.replace('href="', "").replace('"', ""));
  }),
}));

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
      const { minicondaDownloader } = await import(
        "../../installer/download-miniconda"
      );
      const inputs = makeInputs({ installerUrl: "" });
      const result = await minicondaDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns false when installerUrl is set", async () => {
      const { minicondaDownloader } = await import(
        "../../installer/download-miniconda"
      );
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
      const { minicondaDownloader } = await import(
        "../../installer/download-miniconda"
      );
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
    // Set up the mock to include the expected installer name in the versions list
    const fs = await import("fs");
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      `<a href="/Miniconda3-latest-${osName}-x86_64.sh">link</a>`,
    );

    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
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
    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
    const inputs = makeInputs({ architecture: "sparc" });

    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(/Invalid arch/i);
  });

  it("throws when the requested version is not found in available versions", async () => {
    const fs = await import("fs");
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      `<a href="/Miniconda3-latest-${osName}-x86_64.sh">link</a>`,
    );

    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
    const inputs = makeInputs({
      minicondaVersion: "nonexistent-version",
      architecture: "x64",
    });

    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(
      /Invalid miniconda version/i,
    );
  });

  it("maps architecture names through MINICONDA_ARCHITECTURES", async () => {
    const fs = await import("fs");
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      `<a href="/Miniconda3-latest-${osName}-aarch64.sh">link</a>`,
    );

    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
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
    const fs = await import("fs");
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      `<a href="/Miniconda3-latest-${osName}-x86_64.sh">link</a>`,
    );

    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
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

  it("returns empty array and warns when minicondaVersions fetch fails (lines 33-34)", async () => {
    // Make tc.downloadTool throw so minicondaVersions enters the catch branch
    const tc = await import("@actions/tool-cache");
    vi.mocked(tc.downloadTool).mockRejectedValueOnce(
      new Error("Network failure"),
    );
    const core = await import("@actions/core");

    mockEnsureLocalInstaller.mockResolvedValue("/tmp/miniconda.sh");
    const { downloadMiniconda } = await import(
      "../../installer/download-miniconda"
    );
    const inputs = makeInputs({
      minicondaVersion: "latest",
      architecture: "x64",
    });

    // When minicondaVersions returns [] (catch branch), the versions check
    // `if (versions)` is truthy (empty array is truthy) but
    // `versions.includes(...)` returns false, so it throws "Invalid miniconda version".
    await expect(downloadMiniconda(3, inputs)).rejects.toThrow(
      /Invalid miniconda version/i,
    );

    // The catch branch should have called core.warning
    expect(core.warning).toHaveBeenCalledWith(expect.any(Error));
  });
});

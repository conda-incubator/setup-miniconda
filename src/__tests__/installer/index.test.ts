import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

const mockExecute = vi.fn();
vi.mock("../../utils", () => ({
  execute: (...args: any[]) => mockExecute(...args),
}));

const mockIsMambaInstalled = vi.fn();
vi.mock("../../conda", () => ({
  isMambaInstalled: (...args: any[]) => mockIsMambaInstalled(...args),
}));

// Mock all four installer providers so we can control their behavior
const mockBundledProvides = vi.fn();
const mockBundledInstallerPath = vi.fn();
const mockUrlProvides = vi.fn();
const mockUrlInstallerPath = vi.fn();
const mockMiniforgeProvides = vi.fn();
const mockMiniforgeInstallerPath = vi.fn();
const mockMinicondaProvides = vi.fn();
const mockMinicondaInstallerPath = vi.fn();

vi.mock("../../installer/bundled-miniconda", () => ({
  bundledMinicondaUser: {
    label: "use bundled Miniconda",
    provides: (...args: any[]) => mockBundledProvides(...args),
    installerPath: (...args: any[]) => mockBundledInstallerPath(...args),
  },
}));

vi.mock("../../installer/download-url", () => ({
  urlDownloader: {
    label: "download a custom installer by URL",
    provides: (...args: any[]) => mockUrlProvides(...args),
    installerPath: (...args: any[]) => mockUrlInstallerPath(...args),
  },
}));

vi.mock("../../installer/download-miniforge", () => ({
  miniforgeDownloader: {
    label: "download Miniforge",
    provides: (...args: any[]) => mockMiniforgeProvides(...args),
    installerPath: (...args: any[]) => mockMiniforgeInstallerPath(...args),
  },
}));

vi.mock("../../installer/download-miniconda", () => ({
  minicondaDownloader: {
    label: "download Miniconda",
    provides: (...args: any[]) => mockMinicondaProvides(...args),
    installerPath: (...args: any[]) => mockMinicondaInstallerPath(...args),
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
// Tests — getLocalInstallerPath
// ---------------------------------------------------------------------------

describe("getLocalInstallerPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all providers return false
    mockBundledProvides.mockResolvedValue(false);
    mockUrlProvides.mockResolvedValue(false);
    mockMiniforgeProvides.mockResolvedValue(false);
    mockMinicondaProvides.mockResolvedValue(false);
  });

  it("uses the first matching provider (bundled)", async () => {
    const expectedResult = {
      localInstallerPath: "",
      options: makeOptions({ useBundled: true }),
    };
    mockBundledProvides.mockResolvedValue(true);
    mockBundledInstallerPath.mockResolvedValue(expectedResult);

    const { getLocalInstallerPath } = await import("../../installer/index");
    const result = await getLocalInstallerPath(makeInputs(), makeOptions());

    expect(result).toEqual(expectedResult);
    // Should not check further providers once bundled matches
    expect(mockUrlProvides).not.toHaveBeenCalled();
    expect(mockMiniforgeProvides).not.toHaveBeenCalled();
    expect(mockMinicondaProvides).not.toHaveBeenCalled();
  });

  it("falls through to URL downloader when bundled does not provide", async () => {
    const expectedResult = {
      localInstallerPath: "/tmp/installer.sh",
      options: makeOptions({ useBundled: false }),
    };
    mockBundledProvides.mockResolvedValue(false);
    mockUrlProvides.mockResolvedValue(true);
    mockUrlInstallerPath.mockResolvedValue(expectedResult);

    const { getLocalInstallerPath } = await import("../../installer/index");
    const result = await getLocalInstallerPath(makeInputs(), makeOptions());

    expect(result).toEqual(expectedResult);
    expect(mockBundledProvides).toHaveBeenCalled();
    expect(mockMiniforgeProvides).not.toHaveBeenCalled();
  });

  it("falls through to miniforge downloader", async () => {
    const expectedResult = {
      localInstallerPath: "/tmp/miniforge.sh",
      options: makeOptions({ useBundled: false }),
    };
    mockBundledProvides.mockResolvedValue(false);
    mockUrlProvides.mockResolvedValue(false);
    mockMiniforgeProvides.mockResolvedValue(true);
    mockMiniforgeInstallerPath.mockResolvedValue(expectedResult);

    const { getLocalInstallerPath } = await import("../../installer/index");
    const result = await getLocalInstallerPath(makeInputs(), makeOptions());

    expect(result).toEqual(expectedResult);
  });

  it("falls through to miniconda downloader (last resort)", async () => {
    const expectedResult = {
      localInstallerPath: "/tmp/miniconda.sh",
      options: makeOptions({ useBundled: false }),
    };
    mockBundledProvides.mockResolvedValue(false);
    mockUrlProvides.mockResolvedValue(false);
    mockMiniforgeProvides.mockResolvedValue(false);
    mockMinicondaProvides.mockResolvedValue(true);
    mockMinicondaInstallerPath.mockResolvedValue(expectedResult);

    const { getLocalInstallerPath } = await import("../../installer/index");
    const result = await getLocalInstallerPath(makeInputs(), makeOptions());

    expect(result).toEqual(expectedResult);
  });

  it("throws when no provider matches", async () => {
    mockBundledProvides.mockResolvedValue(false);
    mockUrlProvides.mockResolvedValue(false);
    mockMiniforgeProvides.mockResolvedValue(false);
    mockMinicondaProvides.mockResolvedValue(false);

    const { getLocalInstallerPath } = await import("../../installer/index");
    await expect(
      getLocalInstallerPath(makeInputs(), makeOptions()),
    ).rejects.toThrow(/No installer could be found/);
  });
});

// ---------------------------------------------------------------------------
// Tests — runInstaller
// ---------------------------------------------------------------------------

describe("runInstaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue("");
    mockIsMambaInstalled.mockReturnValue(false);
  });

  it("runs bash for .sh installers", async () => {
    const { runInstaller } = await import("../../installer/index");
    await runInstaller(
      "/tmp/Miniconda3-latest-Linux-x86_64.sh",
      "/opt/conda",
      makeInputs(),
      makeOptions(),
    );

    expect(mockExecute).toHaveBeenCalledWith([
      "bash",
      "/tmp/Miniconda3-latest-Linux-x86_64.sh",
      "-f",
      "-b",
      "-p",
      "/opt/conda",
    ]);
  });

  it("runs silent exe for .exe installers", async () => {
    const { runInstaller } = await import("../../installer/index");
    await runInstaller(
      "C:\\temp\\Miniconda3-latest-Windows-x86_64.exe",
      "C:\\Miniconda3",
      makeInputs(),
      makeOptions(),
    );

    expect(mockExecute).toHaveBeenCalledWith([
      expect.stringContaining("/InstallationType=JustMe"),
    ]);
    const cmd = mockExecute.mock.calls[0][0][0] as string;
    expect(cmd).toContain("/RegisterPython=0");
    expect(cmd).toContain("/S");
    expect(cmd).toContain("/D=C:\\Miniconda3");
  });

  it("throws for unknown installer extension", async () => {
    const { runInstaller } = await import("../../installer/index");
    await expect(
      runInstaller(
        "/tmp/installer.pkg",
        "/opt/conda",
        makeInputs(),
        makeOptions(),
      ),
    ).rejects.toThrow(/Unknown installer extension.*\.pkg/);
  });

  it("detects mamba in installer and updates options when useMamba=true", async () => {
    mockIsMambaInstalled.mockReturnValue(true);
    const { runInstaller } = await import("../../installer/index");
    const result = await runInstaller(
      "/tmp/installer.sh",
      "/opt/conda",
      makeInputs({ useMamba: "true" }),
      makeOptions({ useMamba: false, mambaInInstaller: false }),
    );

    expect(result.mambaInInstaller).toBe(true);
    expect(result.useMamba).toBe(true);
  });

  it("detects mamba in installer but does not enable useMamba when useMamba!=true", async () => {
    mockIsMambaInstalled.mockReturnValue(true);
    const { runInstaller } = await import("../../installer/index");
    const result = await runInstaller(
      "/tmp/installer.sh",
      "/opt/conda",
      makeInputs({ useMamba: "false" }),
      makeOptions({ useMamba: false, mambaInInstaller: false }),
    );

    expect(result.mambaInInstaller).toBe(true);
    expect(result.useMamba).toBe(false);
  });

  it("does not modify options when mamba is not in installer", async () => {
    mockIsMambaInstalled.mockReturnValue(false);
    const { runInstaller } = await import("../../installer/index");
    const originalOptions = makeOptions({
      useMamba: false,
      mambaInInstaller: false,
    });
    const result = await runInstaller(
      "/tmp/installer.sh",
      "/opt/conda",
      makeInputs(),
      originalOptions,
    );

    // Options should be the original since mamba was not found
    expect(result).toEqual(originalOptions);
  });
});

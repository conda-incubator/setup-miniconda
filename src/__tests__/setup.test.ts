import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../types";

// ---------------------------------------------------------------------------
// Mocks — vi.mock() calls are hoisted above imports by vitest, so these
// run before `setup.ts` is evaluated (which matters because of `void run()`).
// ---------------------------------------------------------------------------

// @actions/core
const mockGroup = vi.fn(async (_label: string, fn: () => Promise<unknown>) =>
  fn(),
);
const mockInfo = vi.fn();
const mockSetFailed = vi.fn();
const mockGetState = vi.fn(() => "");

vi.mock("@actions/core", () => ({
  group: mockGroup,
  info: mockInfo,
  setFailed: mockSetFailed,
  getState: mockGetState,
}));

// fs
const mockExistsSync = vi.fn(() => true);
const mockUnlinkSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}));

// ./input
const mockParseInputs = vi.fn();
vi.mock("../input", () => ({
  parseInputs: mockParseInputs,
}));

// ./outputs
const mockSetPathVariables = vi.fn();
vi.mock("../outputs", () => ({
  setPathVariables: mockSetPathVariables,
}));

// ./installer
const mockGetLocalInstallerPath = vi.fn();
const mockRunInstaller = vi.fn();
vi.mock("../installer", () => ({
  getLocalInstallerPath: mockGetLocalInstallerPath,
  runInstaller: mockRunInstaller,
}));

// ./conda
const mockBootstrapConfig = vi.fn();
const mockCondaBasePath = vi.fn(() => "/mock/conda");
const mockWriteCondaConfig = vi.fn();
const mockCondaInit = vi.fn();
const mockCondaInitActivation = vi.fn();
vi.mock("../conda", () => ({
  bootstrapConfig: mockBootstrapConfig,
  condaBasePath: mockCondaBasePath,
  writeCondaConfig: mockWriteCondaConfig,
  condaInit: mockCondaInit,
  condaInitActivation: mockCondaInitActivation,
}));

// ./env
const mockEnsureEnvironment = vi.fn();
const mockGetEnvSpec = vi.fn(() => ({}));
vi.mock("../env", () => ({
  ensureEnvironment: mockEnsureEnvironment,
  getEnvSpec: mockGetEnvSpec,
}));

// ./base-tools
const mockInstallBaseTools = vi.fn(
  async (_inputs: unknown, options: types.IDynamicOptions) => options,
);
vi.mock("../base-tools", () => ({
  installBaseTools: mockInstallBaseTools,
}));

// ./constants — re-export real values but with mocks for state keys
vi.mock("../constants", () => ({
  CONDARC_PATH: "/mock/.condarc",
  OUTPUT_ENV_FILE_WAS_PATCHED: "environment-file-was-patched",
  OUTPUT_ENV_FILE_PATH: "environment-file",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return {
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
    condaConfig: {
      add_anaconda_token: "",
      add_pip_as_python_dependency: "",
      allow_softlinks: "",
      auto_activate: "false",
      auto_update_conda: "false",
      channel_alias: "",
      channel_priority: "",
      channels: "conda-forge",
      default_activation_env: "",
      show_channel_urls: "",
      use_only_tar_bz2: "",
      always_yes: "true",
      changeps1: "false",
      solver: "",
      pkgs_dirs: "",
    },
    ...overrides,
  };
}

function defaultInstallerInfo(
  overrides: Partial<types.IInstallerResult> = {},
): types.IInstallerResult {
  return {
    localInstallerPath: "",
    options: {
      useBundled: true,
      useMamba: false,
      mambaInInstaller: false,
      condaConfig: {},
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default happy-path mocks
    const inputs = makeInputs();
    mockParseInputs.mockResolvedValue(inputs);
    mockGetLocalInstallerPath.mockResolvedValue(defaultInstallerInfo());
    mockExistsSync.mockReturnValue(true);
    mockGetState.mockReturnValue("");
    mockInstallBaseTools.mockImplementation(async (_i, opts) => opts);
  });

  async function importAndRun() {
    // vi.resetModules() in beforeEach ensures each import re-evaluates the
    // module, so `void run()` fires exactly once as a side effect.
    // We then flush microtasks so the fire-and-forget run() promise settles.
    await import("../setup");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("successful full flow — all steps called in order", async () => {
    await importAndRun();

    // Verify the core steps were invoked exactly once
    expect(mockParseInputs).toHaveBeenCalledOnce();
    expect(mockBootstrapConfig).toHaveBeenCalledOnce();
    expect(mockGetLocalInstallerPath).toHaveBeenCalledOnce();
    expect(mockSetPathVariables).toHaveBeenCalledOnce();
    expect(mockGetEnvSpec).toHaveBeenCalledOnce();
    expect(mockWriteCondaConfig).toHaveBeenCalledOnce();
    expect(mockCondaInit).toHaveBeenCalledOnce();
    expect(mockInstallBaseTools).toHaveBeenCalledOnce();
    expect(mockCondaInitActivation).toHaveBeenCalledOnce();
    expect(mockInfo).toHaveBeenCalledWith("setup-miniconda ran successfully");

    // setFailed should NOT have been called
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it("error handling — setFailed called on error", async () => {
    mockParseInputs.mockRejectedValue(new Error("boom"));

    await importAndRun();

    expect(mockSetFailed).toHaveBeenCalledWith("boom");
  });

  it("activateEnvironment is 'base' — skip ensureEnvironment", async () => {
    mockParseInputs.mockResolvedValue(
      makeInputs({ activateEnvironment: "base" }),
    );

    await importAndRun();

    expect(mockEnsureEnvironment).not.toHaveBeenCalled();
  });

  it("activateEnvironment is set — ensureEnvironment called", async () => {
    mockParseInputs.mockResolvedValue(
      makeInputs({ activateEnvironment: "myenv" }),
    );

    await importAndRun();

    expect(mockEnsureEnvironment).toHaveBeenCalledOnce();
  });

  it("activateEnvironment is empty — skip ensureEnvironment", async () => {
    mockParseInputs.mockResolvedValue(makeInputs({ activateEnvironment: "" }));

    await importAndRun();

    expect(mockEnsureEnvironment).not.toHaveBeenCalled();
  });

  it("patched environment file cleanup — when cleanPatchedEnvironmentFile is 'true'", async () => {
    mockParseInputs.mockResolvedValue(
      makeInputs({ cleanPatchedEnvironmentFile: "true" }),
    );
    mockGetState.mockImplementation((key: string) => {
      if (key === "environment-file-was-patched") return "true";
      if (key === "environment-file") return "/tmp/patched-env.yml";
      return "";
    });

    await importAndRun();

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/patched-env.yml");
    expect(mockInfo).toHaveBeenCalledWith("Cleaned /tmp/patched-env.yml");
  });

  it("patched environment file kept — when cleanPatchedEnvironmentFile is not 'true'", async () => {
    mockParseInputs.mockResolvedValue(
      makeInputs({ cleanPatchedEnvironmentFile: "false" }),
    );
    mockGetState.mockImplementation((key: string) => {
      if (key === "environment-file-was-patched") return "true";
      if (key === "environment-file") return "/tmp/patched-env.yml";
      return "";
    });

    await importAndRun();

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      "Leaving /tmp/patched-env.yml in place",
    );
  });

  it("installer runs when localInstallerPath is set and not bundled", async () => {
    mockGetLocalInstallerPath.mockResolvedValue(
      defaultInstallerInfo({
        localInstallerPath: "/tmp/installer.sh",
        options: {
          useBundled: false,
          useMamba: false,
          mambaInInstaller: false,
          condaConfig: {},
        },
      }),
    );
    mockRunInstaller.mockResolvedValue({
      useBundled: false,
      useMamba: false,
      mambaInInstaller: false,
      condaConfig: {},
    });

    await importAndRun();

    expect(mockRunInstaller).toHaveBeenCalledOnce();
  });

  it("installer skipped when useBundled is true", async () => {
    mockGetLocalInstallerPath.mockResolvedValue(
      defaultInstallerInfo({
        localInstallerPath: "/tmp/installer.sh",
        options: {
          useBundled: true,
          useMamba: false,
          mambaInInstaller: false,
          condaConfig: {},
        },
      }),
    );

    await importAndRun();

    expect(mockRunInstaller).not.toHaveBeenCalled();
  });

  it("throws when basePath does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await importAndRun();

    expect(mockSetFailed).toHaveBeenCalledOnce();
    expect(mockSetFailed.mock.calls[0][0]).toContain(
      "No installed conda 'base' environment found",
    );
  });

  it("passes condaConfigFile through to writeCondaConfig", async () => {
    mockParseInputs.mockResolvedValue(
      makeInputs({ condaConfigFile: "/path/to/.condarc" }),
    );

    await importAndRun();

    expect(mockWriteCondaConfig).toHaveBeenCalledOnce();
    const callArgs = mockWriteCondaConfig.mock.calls[0];
    expect(callArgs[0].condaConfigFile).toBe("/path/to/.condarc");
  });
});

import * as path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../types";

// Mock @actions/core
const mockAddPath = vi.fn();
const mockExportVariable = vi.fn();
const mockSetOutput = vi.fn();
const mockSaveState = vi.fn();
const mockInfo = vi.fn();

vi.mock("@actions/core", () => ({
  addPath: (...args: unknown[]) => mockAddPath(...args),
  exportVariable: (...args: unknown[]) => mockExportVariable(...args),
  setOutput: (...args: unknown[]) => mockSetOutput(...args),
  saveState: (...args: unknown[]) => mockSaveState(...args),
  info: (...args: unknown[]) => mockInfo(...args),
}));

// Mock conda.condaBasePath
const mockCondaBasePath = vi.fn();
vi.mock("../conda", () => ({
  condaBasePath: (...args: unknown[]) => mockCondaBasePath(...args),
}));

// Mock constants — keep real values but allow IS_WINDOWS to be controlled
let mockIsWindows = false;
vi.mock("../constants", () => ({
  get IS_WINDOWS() {
    return mockIsWindows;
  },
  OUTPUT_ENV_FILE_PATH: "environment-file",
  OUTPUT_ENV_FILE_CONTENT: "environment-file-content",
  OUTPUT_ENV_FILE_WAS_PATCHED: "environment-file-was-patched",
}));

/**
 * Build a minimal IActionInputs for testing
 */
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
      channels: "conda-forge",
      default_activation_env: "",
      show_channel_urls: "",
      use_only_tar_bz2: "",
      always_yes: "true",
      changeps1: "false",
      solver: "",
      pkgs_dirs: "",
    }),
    ...overrides,
  });
}

function makeOptions(
  overrides: Partial<types.IDynamicOptions> = {},
): types.IDynamicOptions {
  return {
    useBundled: true,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: {},
    ...overrides,
  };
}

describe("setPathVariables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsWindows = false;
  });

  it("adds condabin to PATH", async () => {
    mockCondaBasePath.mockReturnValue("/opt/conda");
    const { setPathVariables } = await import("../outputs");

    await setPathVariables(makeInputs(), makeOptions());

    expect(mockAddPath).toHaveBeenCalledWith(
      expect.stringContaining("condabin"),
    );
  });

  it("exports CONDA environment variable with the base path", async () => {
    mockCondaBasePath.mockReturnValue("/opt/conda");
    const { setPathVariables } = await import("../outputs");

    await setPathVariables(makeInputs(), makeOptions());

    expect(mockExportVariable).toHaveBeenCalledWith("CONDA", "/opt/conda");
  });

  it("logs the condabin and CONDA paths via core.info", async () => {
    mockCondaBasePath.mockReturnValue("/opt/conda");
    const { setPathVariables } = await import("../outputs");

    await setPathVariables(makeInputs(), makeOptions());

    expect(mockInfo).toHaveBeenCalledTimes(2);
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("condabin"));
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("CONDA"));
  });

  it("passes inputs and options through to condaBasePath", async () => {
    mockCondaBasePath.mockReturnValue("/custom/path");
    const { setPathVariables } = await import("../outputs");
    const inputs = makeInputs({ installationDir: "/custom/path" });
    const options = makeOptions({ useBundled: false });

    await setPathVariables(inputs, options);

    expect(mockCondaBasePath).toHaveBeenCalledWith(inputs, options);
  });

  it("handles a Windows-style base path", async () => {
    mockIsWindows = true;
    mockCondaBasePath.mockReturnValue("C:\\Miniconda3");
    const { setPathVariables } = await import("../outputs");

    await setPathVariables(makeInputs(), makeOptions());

    expect(mockExportVariable).toHaveBeenCalledWith("CONDA", "C:\\Miniconda3");
    // condabin should be appended to the base path
    expect(mockAddPath).toHaveBeenCalledWith(
      expect.stringContaining("condabin"),
    );
  });
});

describe("setEnvironmentFileOutputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets output for environment file path (resolved)", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "name: test");

    expect(mockSetOutput).toHaveBeenCalledWith(
      "environment-file",
      expect.any(String),
    );
    // path.resolve should produce an absolute path
    const resolvedPath = mockSetOutput.mock.calls.find(
      (c: unknown[]) => c[0] === "environment-file",
    )![1] as string;
    expect(path.isAbsolute(resolvedPath)).toBe(true);
  });

  it("sets output for environment file content", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");
    const content = "name: myenv\nchannels:\n  - defaults";

    setEnvironmentFileOutputs("env.yml", content);

    expect(mockSetOutput).toHaveBeenCalledWith(
      "environment-file-content",
      content,
    );
  });

  it("sets patched output to 'false' and saves state as false when patched is not provided", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "content");

    expect(mockSetOutput).toHaveBeenCalledWith(
      "environment-file-was-patched",
      "false",
    );
    expect(mockSaveState).toHaveBeenCalledWith(
      "environment-file-was-patched",
      false,
    );
  });

  it("sets patched output to 'false' and saves state as false when patched=false", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "content", false);

    expect(mockSetOutput).toHaveBeenCalledWith(
      "environment-file-was-patched",
      "false",
    );
    expect(mockSaveState).toHaveBeenCalledWith(
      "environment-file-was-patched",
      false,
    );
  });

  it("sets patched output to 'true' and saves state as true when patched=true", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "content", true);

    expect(mockSetOutput).toHaveBeenCalledWith(
      "environment-file-was-patched",
      "true",
    );
    expect(mockSaveState).toHaveBeenCalledWith(
      "environment-file-was-patched",
      true,
    );
  });

  it("resolves relative env file paths to absolute", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("./relative/env.yml", "content");

    const resolvedPath = mockSetOutput.mock.calls.find(
      (c: unknown[]) => c[0] === "environment-file",
    )![1] as string;
    // path.resolve turns relative into absolute
    expect(resolvedPath).not.toContain("./");
    expect(path.isAbsolute(resolvedPath)).toBe(true);
  });

  it("calls setOutput exactly three times", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "content", true);

    expect(mockSetOutput).toHaveBeenCalledTimes(3);
  });

  it("calls saveState exactly once", async () => {
    const { setEnvironmentFileOutputs } = await import("../outputs");

    setEnvironmentFileOutputs("env.yml", "content");

    expect(mockSaveState).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { makeActionInputs } from "../helpers";

// Mock @actions/core
const mockInfo = vi.fn();
vi.mock("@actions/core", () => ({
  info: (...args: unknown[]) => mockInfo(...args),
  warning: vi.fn(),
}));

// Mock conda
const mockCondaCommand = vi.fn(async () => {});

// Mock utils
vi.mock("../../utils", () => ({
  makeSpec: vi.fn((pkg: string, spec: string) => {
    if (spec.match(/[=<>!\|]/)) {
      return `${pkg}${spec}`;
    }
    return `${pkg}=${spec}`;
  }),
  isBaseEnv: vi.fn(() => false),
}));

// Mock fs for update-mamba
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    symlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock constants
vi.mock("../../constants", () => ({
  IS_UNIX: true,
  IS_WINDOWS: false,
  IS_MAC: false,
  IS_LINUX: true,
  MINICONDA_DIR_PATH: "/opt/conda",
}));

// Mock conda functions used by update-mamba's postInstall
vi.mock("../../conda", async () => ({
  condaCommand: (...args: unknown[]) => mockCondaCommand(...args),
  condaExecutable: vi.fn(() => "/opt/conda/bin/mamba"),
  condaBasePath: vi.fn(() => "/opt/conda"),
}));

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return makeActionInputs({
    ...overrides,
    condaConfig: { channels: "conda-forge", ...overrides.condaConfig },
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

describe("installBaseTools", () => {
  let installBaseTools: (
    inputs: types.IActionInputs,
    options: types.IDynamicOptions,
  ) => Promise<types.IDynamicOptions>;

  beforeEach(async () => {
    vi.resetModules();
    mockCondaCommand.mockReset();
    mockInfo.mockReset();
    const mod = await import("../../base-tools/index");
    installBaseTools = mod.installBaseTools;
  });

  it("does not run conda commands when no tools need updating", async () => {
    const inputs = makeInputs();
    const options = makeOptions();

    await installBaseTools(inputs, options);

    expect(mockCondaCommand).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      "No tools were installed in 'base' env.",
    );
  });

  it("runs conda install when one tool needs updating", async () => {
    const inputs = makeInputs({ condaVersion: "23.1.0" });
    const options = makeOptions();

    await installBaseTools(inputs, options);

    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
    expect(mockCondaCommand).toHaveBeenCalledWith(
      ["install", "--name", "base", "conda=23.1.0"],
      inputs,
      options,
    );
  });

  it("does not call applyCondaConfiguration (config is written upfront)", async () => {
    const inputs = makeInputs({ condaVersion: "23.1.0" });
    const options = makeOptions();

    await installBaseTools(inputs, options);

    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
  });

  it("installs multiple tools in a single conda command", async () => {
    const inputs = makeInputs({
      condaVersion: "23.1.0",
      condaBuildVersion: "3.27.0",
    });
    const options = makeOptions();

    await installBaseTools(inputs, options);

    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
    const callArgs = mockCondaCommand.mock.calls[0][0] as string[];
    expect(callArgs).toContain("conda=23.1.0");
    expect(callArgs).toContain("conda-build=3.27.0");
    expect(callArgs[0]).toBe("install");
    expect(callArgs[1]).toBe("--name");
    expect(callArgs[2]).toBe("base");
  });

  it("runs post-install actions when defined (mamba)", async () => {
    const inputs = makeInputs({ mambaVersion: "1.5.0" });
    const options = makeOptions();

    await installBaseTools(inputs, options);

    // mamba has postInstall, so there should be post-install log messages
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining("post-install steps"),
    );
  });

  it("logs no post-install message when no post-install actions exist", async () => {
    const inputs = makeInputs({ condaVersion: "23.1.0" });
    const options = makeOptions();

    await installBaseTools(inputs, options);

    expect(mockInfo).toHaveBeenCalledWith(
      "No post-install actions were taken on 'base' env.",
    );
  });

  it("returns updated options with useMamba when mamba is installed", async () => {
    const inputs = makeInputs({ mambaVersion: "1.5.0" });
    const options = makeOptions({ useMamba: false });

    const result = await installBaseTools(inputs, options);

    expect(result.useMamba).toBe(true);
  });

  it("returns original options shape when no tools installed", async () => {
    const inputs = makeInputs();
    const options = makeOptions();

    const result = await installBaseTools(inputs, options);

    expect(result.useBundled).toBe(options.useBundled);
    expect(result.useMamba).toBe(options.useMamba);
    expect(result.mambaInInstaller).toBe(options.mambaInInstaller);
  });

  it("merges options from multiple tool providers", async () => {
    const inputs = makeInputs({
      condaVersion: "23.1.0",
      mambaVersion: "1.5.0",
    });
    const options = makeOptions();

    const result = await installBaseTools(inputs, options);

    // mamba provider sets useMamba: true
    expect(result.useMamba).toBe(true);
  });
});

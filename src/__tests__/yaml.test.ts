import { describe, it, expect, vi, beforeEach } from "vitest";

import * as yaml from "js-yaml";

import type * as types from "../types";
import { ensureYaml } from "../env/yaml";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock @actions/io
vi.mock("@actions/io", () => ({
  rmRF: vi.fn(),
}));

// Mock fs
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ""),
  };
});

// Mock utils — keep makeSpec real, mock execute
vi.mock("../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils")>();
  return {
    ...actual,
    execute: vi.fn(async () => ""),
  };
});

// Mock conda
vi.mock("../conda", () => ({
  condaBasePath: vi.fn(() => "/mock/conda"),
  envCommandFlag: vi.fn(() => ["--name", "test"]),
}));

// Mock outputs
vi.mock("../outputs", () => ({
  setEnvironmentFileOutputs: vi.fn(),
}));

/**
 * Build minimal IActionInputs for YAML env testing
 */
function makeInputs(
  overrides: Partial<{ pythonVersion: string; environmentFile: string }> = {},
): types.IActionInputs {
  return Object.freeze({
    activateEnvironment: "test",
    architecture: "x64",
    condaBuildVersion: "",
    condaConfigFile: "",
    condaVersion: "",
    environmentFile: overrides.environmentFile ?? "environment.yml",
    installerUrl: "",
    installationDir: "",
    mambaVersion: "",
    minicondaVersion: "",
    miniforgeVariant: "",
    miniforgeVersion: "",
    condaRemoveDefaults: "false",
    pythonVersion: overrides.pythonVersion ?? "",
    removeProfiles: "true",
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
  });
}

function makeOptions(yamlData?: types.IEnvironment): types.IDynamicOptions {
  return {
    useBundled: false,
    useMamba: false,
    mambaInInstaller: false,
    envSpec: yamlData ? { yaml: yamlData } : undefined,
    condaConfig: {},
  };
}

describe("ensureYaml python-version patching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces existing python spec when pythonVersion is set (#286, #244)", async () => {
    // Simulate an environment.yml with python=3.9 already in dependencies
    const yamlData: types.IEnvironment = {
      name: "test",
      channels: ["conda-forge"],
      dependencies: ["python=3.9", "numpy", "pandas"],
    };

    const inputs = makeInputs({ pythonVersion: "3.11" });
    const options = makeOptions(yamlData);

    await ensureYaml.condaArgs(inputs, options);

    // The patched file should have been written
    const fs = await import("fs");
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall).toBeDefined();

    const writtenContent = writeCall[1] as string;
    const parsed = yaml.load(writtenContent) as types.IEnvironment;

    // python=3.11 should REPLACE python=3.9, not be appended alongside it
    const pythonSpecs = (parsed.dependencies || []).filter(
      (dep) => typeof dep === "string" && dep.startsWith("python"),
    );
    expect(pythonSpecs).toEqual(["python=3.11"]);
    expect(parsed.dependencies).not.toContain("python=3.9");
  });

  it("preserves name=version=build specs without corruption (#286)", async () => {
    // Simulate an environment.yml with name=version=build syntax
    const yamlData: types.IEnvironment = {
      name: "test",
      channels: ["conda-forge"],
      dependencies: ["numpy=1.24.0=py311h54d7cd4_0", "python=3.11"],
    };

    const inputs = makeInputs({ pythonVersion: "3.11" });
    const options = makeOptions(yamlData);

    await ensureYaml.condaArgs(inputs, options);

    const fs = await import("fs");
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall).toBeDefined();

    const writtenContent = writeCall[1] as string;
    const parsed = yaml.load(writtenContent) as types.IEnvironment;

    // numpy spec should not be corrupted (= should not become ==)
    const numpySpec = (parsed.dependencies || []).find(
      (dep) => typeof dep === "string" && dep.startsWith("numpy"),
    );
    expect(numpySpec).toBe("numpy=1.24.0=py311h54d7cd4_0");
  });

  it("appends python spec when none exists in deps", async () => {
    const yamlData: types.IEnvironment = {
      name: "test",
      channels: ["conda-forge"],
      dependencies: ["numpy", "pandas"],
    };

    const inputs = makeInputs({ pythonVersion: "3.10" });
    const options = makeOptions(yamlData);

    await ensureYaml.condaArgs(inputs, options);

    const fs = await import("fs");
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall).toBeDefined();

    const writtenContent = writeCall[1] as string;
    const parsed = yaml.load(writtenContent) as types.IEnvironment;

    expect(parsed.dependencies).toContain("python=3.10");
    expect(parsed.dependencies).toHaveLength(3); // numpy, pandas, python=3.10
  });

  it("does not patch when pythonVersion is empty", async () => {
    const yamlData: types.IEnvironment = {
      name: "test",
      channels: ["conda-forge"],
      dependencies: ["python=3.9", "numpy"],
    };

    const inputs = makeInputs({ pythonVersion: "" });
    const options = makeOptions(yamlData);

    await ensureYaml.condaArgs(inputs, options);

    // No patched file should have been written
    const fs = await import("fs");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("preserves pip dependencies alongside python patching", async () => {
    const yamlData: types.IEnvironment = {
      name: "test",
      channels: ["conda-forge"],
      dependencies: ["python=3.9", "numpy", { pip: ["requests", "flask"] }],
    };

    const inputs = makeInputs({ pythonVersion: "3.11" });
    const options = makeOptions(yamlData);

    await ensureYaml.condaArgs(inputs, options);

    const fs = await import("fs");
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall).toBeDefined();

    const writtenContent = writeCall[1] as string;
    const parsed = yaml.load(writtenContent) as types.IEnvironment;

    // pip deps should be preserved
    const pipDep = (parsed.dependencies || []).find(
      (dep) => typeof dep === "object" && "pip" in dep,
    );
    expect(pipDep).toBeDefined();

    // python should be replaced, not duplicated
    const pythonSpecs = (parsed.dependencies || []).filter(
      (dep) => typeof dep === "string" && dep.startsWith("python"),
    );
    expect(pythonSpecs).toEqual(["python=3.11"]);
  });
});

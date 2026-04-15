import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// Mock @actions/core
const mockInfo = vi.fn();
const mockGroup = vi.fn(async (_title: string, fn: () => Promise<void>) => {
  return fn();
});
vi.mock("@actions/core", () => ({
  info: (...args: any[]) => mockInfo(...args),
  warning: vi.fn(),
  group: (...args: any[]) => mockGroup(...args),
}));

// Mock fs
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => ""),
    writeFileSync: vi.fn(),
  };
});

// Mock js-yaml
vi.mock("js-yaml", () => ({
  load: vi.fn(() => ({ name: "test", channels: ["conda-forge"] })),
}));

// Mock conda
const mockCondaCommand = vi.fn(async () => {});
vi.mock("../../conda", () => ({
  condaCommand: (...args: any[]) => mockCondaCommand(...args),
  envCommandFlag: vi.fn(() => ["--name", "test"]),
  condaBasePath: vi.fn(() => "/mock/conda"),
}));

// Mock utils
vi.mock("../../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils")>();
  return {
    ...actual,
    execute: vi.fn(async () => ""),
  };
});

// Mock outputs
vi.mock("../../outputs", () => ({
  setEnvironmentFileOutputs: vi.fn(),
}));

/**
 * Build minimal IActionInputs
 */
function makeInputs(
  overrides: Partial<{
    activateEnvironment: string;
    environmentFile: string;
    pythonVersion: string;
  }> = {},
): types.IActionInputs {
  return Object.freeze({
    activateEnvironment: overrides.activateEnvironment ?? "test",
    architecture: "x64",
    condaBuildVersion: "",
    condaConfigFile: "",
    condaVersion: "",
    environmentFile: overrides.environmentFile ?? "",
    installerUrl: "",
    installationDir: "",
    mambaVersion: "",
    minicondaVersion: "",
    miniforgeVariant: "",
    miniforgeVersion: "",
    condaRemoveDefaults: "false",
    pythonVersion: overrides.pythonVersion ?? "",
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
  });
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

describe("getEnvSpec", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty object when no environmentFile is set", async () => {
    const { getEnvSpec } = await import("../../env/index");
    const inputs = makeInputs({ environmentFile: "" });
    const result = await getEnvSpec(inputs);
    expect(result).toEqual({});
  });

  it("returns yaml spec for a YAML environment file", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReturnValue(
      "name: test\nchannels:\n  - conda-forge\n",
    );

    const yaml = await import("js-yaml");
    vi.mocked(yaml.load).mockReturnValue({
      name: "test",
      channels: ["conda-forge"],
    });

    // Set GITHUB_WORKSPACE so path.join works
    const origWorkspace = process.env["GITHUB_WORKSPACE"];
    process.env["GITHUB_WORKSPACE"] = "/workspace";

    const { getEnvSpec } = await import("../../env/index");
    const inputs = makeInputs({ environmentFile: "environment.yml" });
    const result = await getEnvSpec(inputs);

    expect(result.yaml).toEqual({
      name: "test",
      channels: ["conda-forge"],
    });
    expect(result.explicit).toBeUndefined();

    process.env["GITHUB_WORKSPACE"] = origWorkspace;
  });

  it("returns explicit spec when file contains @EXPLICIT marker", async () => {
    const explicitContent = "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2\n";

    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReturnValue(explicitContent);

    const origWorkspace = process.env["GITHUB_WORKSPACE"];
    process.env["GITHUB_WORKSPACE"] = "/workspace";

    const { getEnvSpec } = await import("../../env/index");
    const inputs = makeInputs({ environmentFile: "env.lock" });
    const result = await getEnvSpec(inputs);

    expect(result.explicit).toBe(explicitContent);
    expect(result.yaml).toEqual({});

    process.env["GITHUB_WORKSPACE"] = origWorkspace;
  });
});

describe("ensureEnvironment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore mockGroup implementation after reset so core.group executes its callback
    mockGroup.mockImplementation(
      async (_title: string, fn: () => Promise<void>) => fn(),
    );
  });

  it("runs the first matching provider", async () => {
    const { ensureEnvironment } = await import("../../env/index");

    // With explicit content, ensureExplicit should match first
    const inputs = makeInputs({ environmentFile: "env.lock" });
    const options = makeOptions({
      envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2" },
    });

    await ensureEnvironment(inputs, options);

    // Should have called condaCommand with the explicit provider's args
    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
    const args = mockCondaCommand.mock.calls[0][0];
    expect(args).toContain("create");
    expect(args).toContain("--file");
  });

  it("falls through to simple provider when no envSpec", async () => {
    const { ensureEnvironment } = await import("../../env/index");

    const inputs = makeInputs();
    const options = makeOptions({ envSpec: {} });

    await ensureEnvironment(inputs, options);

    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
    const args = mockCondaCommand.mock.calls[0][0];
    expect(args[0]).toBe("create");
  });

  it("uses yaml provider when envSpec has yaml data", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReturnValue(
      "name: test\nchannels:\n  - conda-forge\n",
    );
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { ensureEnvironment } = await import("../../env/index");

    const inputs = makeInputs({ environmentFile: "environment.yml" });
    const options = makeOptions({
      envSpec: {
        yaml: {
          name: "test",
          channels: ["conda-forge"],
          dependencies: ["numpy"],
        },
      },
    });

    await ensureEnvironment(inputs, options);

    expect(mockCondaCommand).toHaveBeenCalledTimes(1);
    const args = mockCondaCommand.mock.calls[0][0];
    expect(args[0]).toBe("env");
  });

  it("logs provider selection process", async () => {
    const { ensureEnvironment } = await import("../../env/index");

    const inputs = makeInputs();
    const options = makeOptions({ envSpec: {} });

    await ensureEnvironment(inputs, options);

    // Should log "Can we..." for providers checked
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("Can we"));
    // Should log "... will" for the matched provider
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("... will"));
  });

  it("wraps conda command in core.group", async () => {
    const { ensureEnvironment } = await import("../../env/index");

    const inputs = makeInputs();
    const options = makeOptions({ envSpec: {} });

    await ensureEnvironment(inputs, options);

    expect(mockGroup).toHaveBeenCalledWith(
      expect.stringContaining("Updating"),
      expect.any(Function),
    );
  });

  it("throws when no provider matches (line 50)", async () => {
    // To reach the throw at line 50 we need every provider.provides() to
    // return false.  Reset modules first so doMock takes effect.
    vi.resetModules();
    vi.doMock("@actions/core", () => ({
      info: vi.fn(),
      warning: vi.fn(),
      group: vi.fn(async (_label: string, fn: () => Promise<any>) => fn()),
    }));
    vi.doMock("../../conda", () => ({
      condaCommand: vi.fn(async () => {}),
      envCommandFlag: vi.fn(() => ["--name", "myenv"]),
    }));
    vi.doMock("../../env/explicit", () => ({
      ensureExplicit: {
        label: "mock-explicit",
        provides: async () => false,
        condaArgs: async () => [],
      },
    }));
    vi.doMock("../../env/simple", () => ({
      ensureSimple: {
        label: "mock-simple",
        provides: async () => false,
        condaArgs: async () => [],
      },
    }));
    vi.doMock("../../env/yaml", () => ({
      ensureYaml: {
        label: "mock-yaml",
        provides: async () => false,
        condaArgs: async () => [],
      },
    }));

    // Re-import so the module picks up the mocked providers
    const { ensureEnvironment: ensureEnvFresh } =
      await import("../../env/index");

    const inputs = makeInputs({ activateEnvironment: "myenv" });
    const options = makeOptions({ envSpec: {} });

    await expect(ensureEnvFresh(inputs, options)).rejects.toThrow(
      "'activate-environment: myenv' could not be created",
    );

    // Restore original mocks so other tests are unaffected
    vi.doUnmock("../../env/explicit");
    vi.doUnmock("../../env/simple");
    vi.doUnmock("../../env/yaml");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as yaml from "js-yaml";

import type * as types from "../types";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  isDebug: vi.fn(() => false),
}));

// Mock @actions/io
vi.mock("@actions/io", () => ({
  cp: vi.fn(),
  rmRF: vi.fn(),
  mv: vi.fn(),
}));

// Mock fs so condaExecutable finds a "conda" binary
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    appendFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ""),
  };
});

// Mock constants — use a getter for MINICONDA_DIR_PATH so tests can control it
let mockMinicondaDirPath = "/opt/miniconda";
vi.mock("../constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../constants")>();
  return {
    ...actual,
    get MINICONDA_DIR_PATH() {
      return mockMinicondaDirPath;
    },
  };
});

// Mock utils.execute so no real commands are run, and capture calls
const executeCalls: { command: string[] }[] = [];
vi.mock("../utils", () => ({
  execute: vi.fn(async (command: string[]) => {
    executeCalls.push({ command });
    // Return valid JSON for --show-sources --json calls
    if (command.includes("--show-sources") && command.includes("--json")) {
      return "{}";
    }
    // Return valid JSON for --show --json calls
    if (command.includes("--show") && command.includes("--json")) {
      return '{"default_activation_env": ""}';
    }
    return "";
  }),
  parseCommaSeparated: vi.fn((value: string) =>
    value
      .trim()
      .split(/,/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0),
  ),
  parsePkgsDirs: vi.fn(() => ["/mock/pkgs"]),
  isBaseEnv: vi.fn(() => false),
}));

/**
 * Build a minimal IActionInputs for testing
 */
function makeInputs(
  overrides: Partial<{
    channels: string;
    condaRemoveDefaults: string;
    runInit: string;
    removeProfiles: string;
  }> = {},
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
    condaRemoveDefaults: overrides.condaRemoveDefaults ?? "false",
    pythonVersion: "",
    removeProfiles: overrides.removeProfiles ?? "true",
    runInit: overrides.runInit ?? "true",
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
      channels: overrides.channels ?? "conda-forge",
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

function makeOptions(): types.IDynamicOptions {
  return {
    useBundled: true,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: {},
  };
}

describe("writeCondaConfig", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.writeFileSync).mockClear();
    vi.mocked(fsMod.readFileSync).mockReturnValue("");
  });

  function getWrittenConfig(): Record<string, unknown> {
    const calls = vi.mocked(fsMod.writeFileSync).mock.calls;
    const lastCall = calls[calls.length - 1];
    return yaml.load(lastCall[1] as string) as Record<string, unknown>;
  }

  it("writes channels from input to condarc", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["channels"]).toContain("conda-forge");
  });

  it("uses channels from envSpec.yaml when input channels are empty", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "" });
    const options: types.IDynamicOptions = {
      ...makeOptions(),
      envSpec: {
        yaml: { channels: ["bioconda", "defaults"] },
      },
    };

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, options);

    const config = getWrittenConfig();
    expect(config["channels"]).toContain("bioconda");
    expect(config["channels"]).toContain("defaults");
  });

  it("handles nodefaults channel by removing defaults", async () => {
    const core = await import("@actions/core");
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "nodefaults,conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["channels"]).not.toContain("defaults");
    expect(config["channels"]).toContain("conda-forge");
    expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
      expect.stringContaining("nodefaults"),
    );
  });

  it("removes defaults when condaRemoveDefaults is true", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({
      channels: "conda-forge",
      condaRemoveDefaults: "true",
    });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["channels"]).not.toContain("defaults");
    expect(config["channels"]).toContain("conda-forge");
  });

  it("keeps defaults when user explicitly adds it", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({
      channels: "defaults,conda-forge",
      condaRemoveDefaults: "true",
    });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["channels"]).toContain("defaults");
  });

  it("warns about implicitly added defaults when removeDefaults is false and no channels exist", async () => {
    const core = await import("@actions/core");
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({
      channels: "",
      condaRemoveDefaults: "false",
    });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, {
      ...makeOptions(),
      envSpec: undefined,
    });

    expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
      expect.stringContaining("defaults"),
    );
  });

  it("merges pkgs_dirs from input", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["pkgs_dirs"]).toContain("/mock/pkgs");
  });

  it("sets auto_activate_base from input when no alias is in existing condarc", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["auto_activate_base"]).toBe(false);
    expect(config).not.toHaveProperty("auto_activate");
  });

  it("prefers auto_activate key when user condarc already contains it (avoids MultipleKeysError on conda 25.11+)", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    // Simulate a user condarc that uses the new canonical key name
    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ auto_activate: true }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config).not.toHaveProperty("auto_activate_base");
    expect(config["auto_activate"]).toBe(false);
  });

  it("uses auto_activate_base when user condarc has auto_activate_base (avoids MultipleKeysError on conda 25.11+)", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ auto_activate_base: false }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["auto_activate_base"]).toBe(false);
    expect(config).not.toHaveProperty("auto_activate");
  });

  it("sets notify_outdated_conda to false", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["notify_outdated_conda"]).toBe(false);
  });

  it("writes config entries and skips empty values", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["always_yes"]).toBe(true);
    expect(config["changeps1"]).toBe(false);
    expect(config).not.toHaveProperty("channel_alias");
  });

  it("warns on unrecognized condarc keys", async () => {
    const core = await import("@actions/core");
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ unknown_key: "value" }),
    );

    await writeCondaConfig(inputs, makeOptions());

    expect(vi.mocked(core.warning)).toHaveBeenCalledWith(
      expect.stringContaining("unknown_key"),
    );
  });

  it("writes YAML to CONDARC_PATH", async () => {
    const constants = await import("../constants");
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    expect(vi.mocked(fsMod.writeFileSync)).toHaveBeenCalledWith(
      constants.CONDARC_PATH,
      expect.any(String),
      "utf8",
    );
  });

  it("reads existing condarc and merges it", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ solver: "libmamba" }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["solver"]).toBe("libmamba");
    expect(config["channels"]).toContain("conda-forge");
  });

  it("reads condaConfigFile and merges it over existing condarc", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = {
      ...makeInputs({ channels: "conda-forge" }),
      condaConfigFile: "my-condarc.yml",
    } as types.IActionInputs;

    const originalWorkspace = process.env["GITHUB_WORKSPACE"];
    process.env["GITHUB_WORKSPACE"] = "/workspace";

    vi.mocked(fsMod.readFileSync).mockImplementation((p: unknown) => {
      const pStr = p as string;
      if (pStr.includes("my-condarc.yml")) {
        return yaml.dump({ solver: "classic", channel_priority: "strict" });
      }
      return yaml.dump({ solver: "libmamba" });
    });

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["solver"]).toBe("classic");
    expect(config["channel_priority"]).toBe("strict");

    if (originalWorkspace !== undefined) {
      process.env["GITHUB_WORKSPACE"] = originalWorkspace;
    } else {
      delete process.env["GITHUB_WORKSPACE"];
    }
  });

  it("handles missing existing condarc gracefully", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.existsSync).mockReturnValue(false);

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["channels"]).toContain("conda-forge");
  });
});

describe("condaInit", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
  });

  it("skips conda init when runInit is false", async () => {
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ runInit: "false" });

    await condaInit(inputs, makeOptions());

    const initCalls = executeCalls.filter((c) => c.command.includes("init"));
    expect(initCalls).toEqual([]);
  });

  it("runs conda init when runInit is true", async () => {
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });

    await condaInit(inputs, makeOptions());

    const initCalls = executeCalls.filter((c) => c.command.includes("init"));
    expect(initCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// New describe blocks for previously untested functions
// ---------------------------------------------------------------------------

describe("condaBasePath", () => {
  it("returns MINICONDA_DIR_PATH when useBundled is true", async () => {
    mockMinicondaDirPath = "/opt/miniconda";
    const { condaBasePath } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions(); // useBundled=true by default

    const result = condaBasePath(inputs, options);
    expect(result).toBe("/opt/miniconda");
  });

  it("returns installationDir when set and not bundled", async () => {
    const { condaBasePath } = await import("../conda");
    const constants = await import("../constants");
    const installDir = constants.IS_WINDOWS
      ? "C:\\custom\\conda\\dir"
      : "/custom/conda/dir";
    const inputs = {
      ...makeInputs(),
      installationDir: installDir,
    } as types.IActionInputs;
    const options = { ...makeOptions(), useBundled: false };

    const result = condaBasePath(inputs, options);
    expect(result).toBe(installDir);
  });

  it("returns default ~/miniconda3 path when neither bundled nor installationDir", async () => {
    const { condaBasePath } = await import("../conda");
    const os = await import("os");
    const path = await import("path");
    const inputs = makeInputs(); // installationDir is ""
    const options = { ...makeOptions(), useBundled: false };

    const result = condaBasePath(inputs, options);
    expect(result).toBe(path.join(os.homedir(), "miniconda3"));
  });
});

describe("envCommandFlag", () => {
  it("returns --name flag for a simple environment name", async () => {
    const { envCommandFlag } = await import("../conda");
    const inputs = {
      ...makeInputs(),
      activateEnvironment: "myenv",
    } as types.IActionInputs;

    const result = envCommandFlag(inputs);
    expect(result).toEqual(["--name", "myenv"]);
  });

  it("returns --prefix flag when activateEnvironment contains a forward slash", async () => {
    const { envCommandFlag } = await import("../conda");
    const inputs = {
      ...makeInputs(),
      activateEnvironment: "/home/user/envs/myenv",
    } as types.IActionInputs;

    const result = envCommandFlag(inputs);
    expect(result).toEqual(["--prefix", "/home/user/envs/myenv"]);
  });

  it("returns --prefix flag when activateEnvironment contains a backslash", async () => {
    const { envCommandFlag } = await import("../conda");
    const inputs = {
      ...makeInputs(),
      activateEnvironment: "C:\\Users\\user\\envs\\myenv",
    } as types.IActionInputs;

    const result = envCommandFlag(inputs);
    expect(result).toEqual(["--prefix", "C:\\Users\\user\\envs\\myenv"]);
  });
});

describe("condaExecutableLocations", () => {
  it("returns conda paths when useMamba is false", async () => {
    const { condaExecutableLocations } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: false };

    const locations = condaExecutableLocations(inputs, options);
    for (const loc of locations) {
      expect(loc).toMatch(/conda/);
      expect(loc).not.toMatch(/mamba/);
    }
  });

  it("returns mamba paths when useMamba is true and subcommand is in MAMBA_SUBCOMMANDS", async () => {
    const { condaExecutableLocations } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: true };

    const locations = condaExecutableLocations(inputs, options, "create");
    for (const loc of locations) {
      expect(loc).toMatch(/mamba/);
    }
  });

  it("falls back to conda paths when useMamba is true but subcommand is not in MAMBA_SUBCOMMANDS", async () => {
    const { condaExecutableLocations } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: true };

    const locations = condaExecutableLocations(inputs, options, "init");
    for (const loc of locations) {
      expect(loc).toMatch(/conda/);
      expect(loc).not.toMatch(/mamba/);
    }
  });

  it("returns mamba paths when useMamba is true and subcommand is undefined", async () => {
    const { condaExecutableLocations } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: true };

    const locations = condaExecutableLocations(inputs, options);
    for (const loc of locations) {
      expect(loc).toMatch(/mamba/);
    }
  });

  it("includes condabin and bin subdirectories", async () => {
    const { condaExecutableLocations } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    const locations = condaExecutableLocations(inputs, options);
    expect(locations.length).toBe(2);
    expect(locations[0]).toMatch(/condabin/);
    expect(locations[1]).toMatch(/bin/);
  });
});

describe("condaExecutable", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    fsMod = await import("fs");
  });

  it("returns the first existing executable path", async () => {
    const { condaExecutable, condaExecutableLocations } =
      await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();
    const locations = condaExecutableLocations(inputs, options);

    // Only the second location exists
    vi.mocked(fsMod.existsSync).mockImplementation((p) => p === locations[1]);

    const result = condaExecutable(inputs, options);
    expect(result).toBe(locations[1]);
  });

  it("throws an error when no executable is found", async () => {
    const { condaExecutable } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(false);

    expect(() => condaExecutable(inputs, options)).toThrow(
      /No existing conda executable found/,
    );
  });

  it("throws mentioning mamba when useMamba is true", async () => {
    const { condaExecutable } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: true };

    vi.mocked(fsMod.existsSync).mockReturnValue(false);

    expect(() => condaExecutable(inputs, options, "create")).toThrow(
      /No existing mamba executable found/,
    );
  });
});

describe("condaCommand", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    // Restore existsSync to always return true so condaExecutable works
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
  });

  it("executes a conda command with the resolved executable", async () => {
    const { condaCommand } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    await condaCommand(["info"], inputs, options);

    expect(executeCalls.length).toBe(1);
    expect(executeCalls[0].command[0]).toMatch(/conda/);
    expect(executeCalls[0].command).toContain("info");
  });

  it("sets MAMBA_ROOT_PREFIX when useMamba is true", async () => {
    const utils = await import("../utils");
    const { condaCommand } = await import("../conda");
    const inputs = makeInputs();
    const options = { ...makeOptions(), useMamba: true };

    await condaCommand(["create", "-n", "test"], inputs, options);

    // utils.execute is called with (command, env, captureOutput)
    const executeCall = vi.mocked(utils.execute).mock.calls.at(-1);
    expect(executeCall).toBeDefined();
    const env = executeCall![1] as Record<string, string>;
    expect(env).toHaveProperty("MAMBA_ROOT_PREFIX");
  });

  it("does not set MAMBA_ROOT_PREFIX when useMamba is false", async () => {
    const utils = await import("../utils");
    const { condaCommand } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions(); // useMamba=false

    await condaCommand(["info"], inputs, options);

    const executeCall = vi.mocked(utils.execute).mock.calls.at(-1);
    expect(executeCall).toBeDefined();
    const env = executeCall![1] as Record<string, string>;
    expect(env).not.toHaveProperty("MAMBA_ROOT_PREFIX");
  });
});

describe("bootstrapConfig", () => {
  it("writes BOOTSTRAP_CONDARC to CONDARC_PATH", async () => {
    const fs = await import("fs");
    const constants = await import("../constants");
    const { bootstrapConfig } = await import("../conda");

    const writeFileSpy = vi
      .spyOn(fs.promises, "writeFile")
      .mockResolvedValue(undefined);

    await bootstrapConfig();

    expect(writeFileSpy).toHaveBeenCalledWith(
      constants.CONDARC_PATH,
      constants.BOOTSTRAP_CONDARC,
    );

    writeFileSpy.mockRestore();
  });
});

describe("writeCondaConfig with condaConfigFile", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.writeFileSync).mockClear();
  });

  it("reads the condaConfigFile from GITHUB_WORKSPACE and merges it", async () => {
    const pathMod = await import("path");
    const { writeCondaConfig } = await import("../conda");

    const inputs = {
      ...makeInputs(),
      condaConfigFile: "my-condarc.yml",
    } as types.IActionInputs;

    const originalWorkspace = process.env["GITHUB_WORKSPACE"];
    process.env["GITHUB_WORKSPACE"] = "/workspace";

    vi.mocked(fsMod.readFileSync).mockImplementation((p: unknown) => {
      const pStr = p as string;
      if (pStr === pathMod.join("/workspace", "my-condarc.yml")) {
        return yaml.dump({ solver: "libmamba" });
      }
      return yaml.dump({});
    });

    await writeCondaConfig(inputs, makeOptions());

    const calls = vi.mocked(fsMod.readFileSync).mock.calls;
    const readPaths = calls.map((c) => c[0] as string);
    expect(readPaths).toContain(pathMod.join("/workspace", "my-condarc.yml"));

    const lastWriteCall = vi.mocked(fsMod.writeFileSync).mock.calls.at(-1);
    const config = yaml.load(lastWriteCall![1] as string) as Record<
      string,
      unknown
    >;
    expect(config["solver"]).toBe("libmamba");

    if (originalWorkspace !== undefined) {
      process.env["GITHUB_WORKSPACE"] = originalWorkspace;
    } else {
      delete process.env["GITHUB_WORKSPACE"];
    }
  });
});

describe("condaInitActivation", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    // Ensure existsSync returns true so profile files are found
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
  });

  it("skips when runInit is false", async () => {
    const core = await import("@actions/core");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "false" });

    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, makeOptions());

    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      expect.stringContaining("Skipping activation profile modifications"),
    );
    // Should not append to any profile files
    expect(vi.mocked(fsMod.appendFileSync)).not.toHaveBeenCalled();
  });

  it("appends to existing shell profile files when runInit is true", async () => {
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, makeOptions());

    // Should have appended to multiple profile files
    expect(vi.mocked(fsMod.appendFileSync).mock.calls.length).toBeGreaterThan(
      0,
    );
  });

  it("does not append to non-existing shell profile files", async () => {
    const { condaInitActivation, condaExecutableLocations } =
      await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = makeOptions();
    const condaLocations = condaExecutableLocations(inputs, options);

    // Conda executables exist (so condaCommand works), but profile files do not
    vi.mocked(fsMod.existsSync).mockImplementation((p) => {
      const pStr = p as string;
      // Allow conda executables to be found
      if (condaLocations.includes(pStr)) return true;
      // All other paths (profile files) don't exist
      return false;
    });
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    expect(vi.mocked(fsMod.appendFileSync)).not.toHaveBeenCalled();
  });

  it("includes conda activate in bash profiles when activateEnvironment is set and not default", async () => {
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    // At least one call should contain "conda activate" for the custom env
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "test"'),
    );
    expect(hasActivate).toBe(true);
  });

  it("includes batch activation lines with autoActivateDefault", async () => {
    const { condaInitActivation } = await import("../conda");
    const inputs = {
      ...makeInputs({ runInit: "true" }),
      condaConfig: {
        ...makeInputs().condaConfig,
        auto_activate: "true",
      },
    } as unknown as types.IActionInputs;
    const options = {
      ...makeOptions(),
      condaConfig: { auto_activate: "true" },
    };

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    // The batch file (conda_hook.bat) should contain the autoActivate line
    const hasBatchAutoActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('@CALL "%CONDA_BAT%" activate'),
    );
    expect(hasBatchAutoActivate).toBe(true);
  });

  it("includes xonsh-specific settings in .xonshrc profile", async () => {
    await import("os");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const xonshCall = appendCalls.find(
      (call) => typeof call[0] === "string" && call[0].includes(".xonshrc"),
    );
    expect(xonshCall).toBeDefined();
    expect(xonshCall![1]).toContain("$RAISE_SUBPROC_ERROR");
    expect(xonshCall![1]).toContain("$XONSH_PIPEFAIL");
  });

  it("includes powershell activation in powershell profiles", async () => {
    await import("os");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const powerShellCall = appendCalls.find(
      (call) => typeof call[0] === "string" && call[0].includes("profile.ps1"),
    );
    expect(powerShellCall).toBeDefined();
    // PowerShell profiles should contain conda activate for the custom env
    expect(powerShellCall![1]).toContain('conda activate "test"');
  });

  it("appends to installationDirectory-based profile paths", async () => {
    const pathMod = await import("path");
    await import("../constants");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();

    await condaInitActivation(inputs, options);

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const appendedPaths = appendCalls.map((c) => c[0] as string);

    // Should include installation-directory based paths like etc/profile.d/conda.sh
    const hasCondaSh = appendedPaths.some((p) =>
      p.includes(pathMod.join("etc", "profile.d", "conda.sh")),
    );
    expect(hasCondaSh).toBe(true);

    // Should include condabin/conda_hook.bat
    const hasCondaHookBat = appendedPaths.some((p) =>
      p.includes(pathMod.join("condabin", "conda_hook.bat")),
    );
    expect(hasCondaHookBat).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// _getFullEnvironmentPath (exercised via condaInitActivation → isDefaultEnvironment)
// isDefaultEnvironment now reads condarc files directly via fs.readFileSync
// ---------------------------------------------------------------------------
describe("_getFullEnvironmentPath coverage", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.appendFileSync).mockClear();
    vi.mocked(fsMod.readFileSync).mockReturnValue("");
  });

  afterEach(async () => {
    vi.mocked(fsMod.readFileSync).mockReturnValue("");
  });

  function mockCondarcWithDefaultEnv(envValue: string) {
    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ default_activation_env: envValue }),
    );
  }

  it("resolves a simple env name to installDir/envs/name when default_activation_env is set", async () => {
    mockCondarcWithDefaultEnv("mydefault");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });

    await condaInitActivation(inputs, makeOptions());

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "test"'),
    );
    expect(hasActivate).toBe(true);
  });

  it("resolves base env name to installDir when default_activation_env is base", async () => {
    const utils = await import("../utils");
    vi.mocked(utils.isBaseEnv).mockImplementation(
      (name) => name === "base" || name === "root" || name === "",
    );
    mockCondarcWithDefaultEnv("base");
    const { condaInitActivation } = await import("../conda");
    const inputs = {
      ...makeInputs({ runInit: "true" }),
      activateEnvironment: "base",
    } as types.IActionInputs;

    await condaInitActivation(inputs, makeOptions());

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "base"'),
    );
    expect(hasActivate).toBe(false);
    vi.mocked(utils.isBaseEnv).mockImplementation(() => false);
  });

  it("resolves ~/ paths via os.homedir when default_activation_env starts with ~/", async () => {
    mockCondarcWithDefaultEnv("~/myenvs/default");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });

    await condaInitActivation(inputs, makeOptions());

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "test"'),
    );
    expect(hasActivate).toBe(true);
  });

  it("resolves absolute paths directly when default_activation_env is absolute", async () => {
    mockCondarcWithDefaultEnv("/opt/envs/production");
    const { condaInitActivation } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });

    await condaInitActivation(inputs, makeOptions());

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "test"'),
    );
    expect(hasActivate).toBe(true);
  });

  it("treats activateEnvironment with / as an absolute path", async () => {
    mockCondarcWithDefaultEnv("someother");
    const { condaInitActivation } = await import("../conda");
    const inputs = {
      ...makeInputs({ runInit: "true" }),
      activateEnvironment: "/custom/path/myenv",
    } as types.IActionInputs;

    await condaInitActivation(inputs, makeOptions());

    const appendCalls = vi.mocked(fsMod.appendFileSync).mock.calls;
    const hasActivate = appendCalls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes('conda activate "/custom/path/myenv"'),
    );
    expect(hasActivate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional coverage for isMambaInstalled
// ---------------------------------------------------------------------------
describe("isMambaInstalled", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    fsMod = await import("fs");
  });

  it("returns false when no mamba executable exists", async () => {
    const { isMambaInstalled } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(false);

    const result = isMambaInstalled(inputs, options);
    expect(result).toBe(false);
  });

  it("returns true when a mamba executable exists", async () => {
    const { isMambaInstalled } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    vi.mocked(fsMod.existsSync).mockReturnValue(true);

    const result = isMambaInstalled(inputs, options);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// condaCommand with captureOutput
// ---------------------------------------------------------------------------
describe("condaCommand captureOutput", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
  });

  it("passes captureOutput=true to execute", async () => {
    const utils = await import("../utils");
    const { condaCommand } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    await condaCommand(["config", "--show", "--json"], inputs, options, true);

    const executeCall = vi.mocked(utils.execute).mock.calls.at(-1);
    expect(executeCall).toBeDefined();
    // Third argument is captureOutput
    expect(executeCall![2]).toBe(true);
  });

  it("passes captureOutput=false by default", async () => {
    const utils = await import("../utils");
    const { condaCommand } = await import("../conda");
    const inputs = makeInputs();
    const options = makeOptions();

    await condaCommand(["info"], inputs, options);

    const executeCall = vi.mocked(utils.execute).mock.calls.at(-1);
    expect(executeCall).toBeDefined();
    // Third argument is captureOutput, default false
    expect(executeCall![2]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writeCondaConfig — additional branches
// ---------------------------------------------------------------------------
describe("writeCondaConfig additional branches", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
    vi.mocked(fsMod.writeFileSync).mockClear();
    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));
  });

  function getWrittenConfig(): Record<string, unknown> {
    const calls = vi.mocked(fsMod.writeFileSync).mock.calls;
    const lastCall = calls[calls.length - 1];
    return yaml.load(lastCall[1] as string) as Record<string, unknown>;
  }

  it("strips defaults from prefix-level condarc when removeDefaults is set", async () => {
    const core = await import("@actions/core");
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({
      channels: "conda-forge",
      condaRemoveDefaults: "true",
    });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults", "conda-forge"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const writeCalls = vi.mocked(fsMod.writeFileSync).mock.calls;
    expect(writeCalls.length).toBeGreaterThan(0);
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      expect.stringContaining("Removing implicitly added 'defaults' channel"),
    );
  });

  it("coerces boolean config values correctly", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(yaml.dump({}));

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    expect(config["auto_update_conda"]).toBe(false);
    expect(config["always_yes"]).toBe(true);
    expect(config["changeps1"]).toBe(false);
  });

  it("preserves existing pkgs_dirs while merging input", async () => {
    const utils = await import("../utils");
    const { writeCondaConfig } = await import("../conda");

    vi.mocked(utils.parsePkgsDirs).mockReturnValue(["/custom/pkgs"]);
    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ pkgs_dirs: ["/existing/pkgs"] }),
    );

    const inputs = makeInputs({ channels: "conda-forge" });
    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    const pkgsDirs = config["pkgs_dirs"] as string[];
    expect(pkgsDirs).toContain("/custom/pkgs");
    expect(pkgsDirs).toContain("/existing/pkgs");

    vi.mocked(utils.parsePkgsDirs).mockReturnValue(["/mock/pkgs"]);
  });

  it("merges channels preserving order (user channels first)", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge,bioconda" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    const channels = config["channels"] as string[];
    expect(channels.indexOf("conda-forge")).toBeLessThan(
      channels.indexOf("bioconda"),
    );
    expect(channels.indexOf("bioconda")).toBeLessThan(
      channels.indexOf("defaults"),
    );
  });

  it("removes defaults from existing channels when removeDefaults is true and no input channels", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({
      channels: "",
      condaRemoveDefaults: "true",
    });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["defaults", "conda-forge"] }),
    );

    await writeCondaConfig(inputs, {
      ...makeOptions(),
      envSpec: undefined,
    });

    const config = getWrittenConfig();
    const channels = config["channels"] as string[];
    expect(channels).not.toContain("defaults");
    expect(channels).toContain("conda-forge");
  });

  it("does not duplicate channels already present in existing config", async () => {
    const { writeCondaConfig } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    vi.mocked(fsMod.readFileSync).mockReturnValue(
      yaml.dump({ channels: ["conda-forge", "defaults"] }),
    );

    await writeCondaConfig(inputs, makeOptions());

    const config = getWrittenConfig();
    const channels = config["channels"] as string[];
    const condaForgeCount = channels.filter((c) => c === "conda-forge").length;
    expect(condaForgeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// condaInit — additional branches
// ---------------------------------------------------------------------------
describe("condaInit additional branches", () => {
  let fsMod: typeof import("fs");

  beforeEach(async () => {
    executeCalls.length = 0;
    fsMod = await import("fs");
    vi.mocked(fsMod.existsSync).mockReturnValue(true);
  });

  it("removes profile files when removeProfiles is true", async () => {
    const ioMod = await import("@actions/io");
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ removeProfiles: "true", runInit: "true" });

    vi.mocked(ioMod.rmRF).mockClear();

    await condaInit(inputs, makeOptions());

    // rmRF should have been called for each existing profile
    expect(vi.mocked(ioMod.rmRF).mock.calls.length).toBeGreaterThan(0);
  });

  it("does not remove profile files when removeProfiles is false", async () => {
    const ioMod = await import("@actions/io");
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ removeProfiles: "false", runInit: "true" });

    vi.mocked(ioMod.rmRF).mockClear();

    await condaInit(inputs, makeOptions());

    expect(vi.mocked(ioMod.rmRF)).not.toHaveBeenCalled();
  });

  it("renames .bashrc to .profile on Linux when removeProfiles is true", async () => {
    const constants = await import("../constants");
    const ioMod = await import("@actions/io");
    await import("os");
    const { condaInit } = await import("../conda");

    // Only run this test if we are on Linux (the code checks constants.IS_LINUX)
    if (!constants.IS_LINUX) {
      // Simulate by checking the code path description — skip on non-Linux
      // We still verify the rename path on Mac below
      return;
    }

    const inputs = makeInputs({ removeProfiles: "true", runInit: "true" });
    vi.mocked(ioMod.mv).mockClear();

    await condaInit(inputs, makeOptions());

    const mvCalls = vi.mocked(ioMod.mv).mock.calls;
    const renameCall = mvCalls.find(
      (call) =>
        (call[0] as string).includes(".bashrc") &&
        (call[1] as string).includes(".profile"),
    );
    expect(renameCall).toBeDefined();
  });

  it("renames .bash_profile to .profile on Mac when removeProfiles is true", async () => {
    const constants = await import("../constants");
    const ioMod = await import("@actions/io");
    const { condaInit } = await import("../conda");

    if (!constants.IS_MAC) {
      return;
    }

    const inputs = makeInputs({ removeProfiles: "true", runInit: "true" });
    vi.mocked(ioMod.mv).mockClear();

    await condaInit(inputs, makeOptions());

    const mvCalls = vi.mocked(ioMod.mv).mock.calls;
    const renameCall = mvCalls.find(
      (call) =>
        (call[0] as string).includes(".bash_profile") &&
        (call[1] as string).includes(".profile"),
    );
    expect(renameCall).toBeDefined();
  });

  it("warns but does not fail when removing a profile file throws", async () => {
    const core = await import("@actions/core");
    const ioMod = await import("@actions/io");
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ removeProfiles: "true", runInit: "true" });

    vi.mocked(ioMod.rmRF).mockRejectedValue(new Error("permission denied"));

    await condaInit(inputs, makeOptions());

    // Should have called core.warning with the error
    expect(vi.mocked(core.warning)).toHaveBeenCalledWith(expect.any(Error));

    // Restore
    vi.mocked(ioMod.rmRF).mockResolvedValue(undefined);
  });

  it("fixes Windows folder ownership when useBundled and IS_WINDOWS", async () => {
    const constants = await import("../constants");

    if (!constants.IS_WINDOWS) {
      // Can't test Windows path on non-Windows, skip
      return;
    }

    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = { ...makeOptions(), useBundled: true };

    await condaInit(inputs, options);

    const takeownCalls = executeCalls.filter((c) =>
      c.command.includes("takeown"),
    );
    expect(takeownCalls.length).toBeGreaterThan(0);
  });

  it("fixes Mac folder ownership when useBundled and IS_MAC", async () => {
    const constants = await import("../constants");

    if (!constants.IS_MAC) {
      return;
    }

    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = { ...makeOptions(), useBundled: true };

    await condaInit(inputs, options);

    const chownCalls = executeCalls.filter((c) => c.command.includes("chown"));
    expect(chownCalls.length).toBeGreaterThan(0);
  });

  it("does not fix ownership when useBundled is false", async () => {
    const { condaInit } = await import("../conda");
    const inputs = makeInputs({ runInit: "true" });
    const options = { ...makeOptions(), useBundled: false };

    await condaInit(inputs, options);

    const ownershipCalls = executeCalls.filter(
      (c) => c.command.includes("chown") || c.command.includes("takeown"),
    );
    expect(ownershipCalls).toEqual([]);
  });
});

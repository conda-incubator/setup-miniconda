import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../types";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock @actions/io
vi.mock("@actions/io", () => ({
  cp: vi.fn(),
}));

// Mock fs so condaExecutable finds a "conda" binary
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
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

/**
 * Extract the conda subcommand args from execute calls.
 * execute() is called with [condaExePath, ...args], so args start at index 1.
 */
function getCondaArgs(): string[][] {
  return executeCalls.map((c) => c.command.slice(1));
}

describe("applyCondaConfiguration", () => {
  beforeEach(() => {
    executeCalls.length = 0;
  });

  it("adds channels on first call (reapply=false)", async () => {
    const { applyCondaConfiguration } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    await applyCondaConfiguration(inputs, makeOptions(), false);

    const args = getCondaArgs();
    const addChannelCalls = args.filter(
      (a) => a.includes("--add") && a.includes("channels"),
    );
    expect(addChannelCalls.length).toBeGreaterThan(0);
    expect(addChannelCalls[0]).toContain("conda-forge");
  });

  it("skips channels on reapply=true (#57)", async () => {
    const { applyCondaConfiguration } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    await applyCondaConfiguration(inputs, makeOptions(), true);

    const args = getCondaArgs();
    const addChannelCalls = args.filter(
      (a) => a.includes("--add") && a.includes("channels"),
    );
    expect(addChannelCalls).toEqual([]);
  });

  it("skips pkgs_dirs on reapply=true (#57)", async () => {
    const { applyCondaConfiguration } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    await applyCondaConfiguration(inputs, makeOptions(), true);

    const args = getCondaArgs();
    const addPkgsDirCalls = args.filter(
      (a) => a.includes("--add") && a.includes("pkgs_dirs"),
    );
    expect(addPkgsDirCalls).toEqual([]);
  });

  it("still applies --set options on reapply=true", async () => {
    const { applyCondaConfiguration } = await import("../conda");
    const inputs = makeInputs({ channels: "conda-forge" });

    await applyCondaConfiguration(inputs, makeOptions(), true);

    const args = getCondaArgs();
    const setCalls = args.filter((a) => a.includes("--set"));
    expect(setCalls.length).toBeGreaterThan(0);
  });
});

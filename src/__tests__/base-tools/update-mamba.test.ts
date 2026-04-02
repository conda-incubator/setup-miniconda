import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// Mock @actions/core
const mockInfo = vi.fn();
vi.mock("@actions/core", () => ({
  info: (...args: any[]) => mockInfo(...args),
  warning: vi.fn(),
}));

// Mock fs
const mockExistsSync = vi.fn(() => true);
const mockSymlinkSync = vi.fn();
const mockWriteFileSync = vi.fn();
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    symlinkSync: (...args: any[]) => mockSymlinkSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
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

// Mock conda
const mockCondaExecutable = vi.fn(() => "/opt/conda/bin/mamba");
const mockCondaBasePath = vi.fn(() => "/opt/conda");
vi.mock("../../conda", () => ({
  condaExecutable: (...args: any[]) => mockCondaExecutable(...args),
  condaBasePath: (...args: any[]) => mockCondaBasePath(...args),
}));

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

describe("updateMamba", () => {
  let updateMamba: types.IToolProvider;

  beforeEach(async () => {
    vi.resetModules();
    mockExistsSync.mockReset().mockReturnValue(true);
    mockSymlinkSync.mockReset();
    mockWriteFileSync.mockReset();
    mockInfo.mockReset();
    mockCondaExecutable.mockReset().mockReturnValue("/opt/conda/bin/mamba");
    mockCondaBasePath.mockReset().mockReturnValue("/opt/conda");
    const mod = await import("../../base-tools/update-mamba");
    updateMamba = mod.updateMamba;
  });

  describe("provides", () => {
    it("returns true when mambaVersion is set", async () => {
      const inputs = makeInputs({ mambaVersion: "1.5.0" });
      expect(await updateMamba.provides(inputs, makeOptions())).toBe(true);
    });

    it("returns true when mambaInInstaller is true", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ mambaInInstaller: true });
      expect(await updateMamba.provides(inputs, options)).toBe(true);
    });

    it("returns false when mambaVersion is empty and mambaInInstaller is false", async () => {
      const inputs = makeInputs();
      expect(await updateMamba.provides(inputs, makeOptions())).toBe(false);
    });
  });

  describe("toolPackages", () => {
    it("returns mamba with version spec when mambaVersion is set", async () => {
      const inputs = makeInputs({ mambaVersion: "1.5.0" });
      const options = makeOptions();
      const result = await updateMamba.toolPackages(inputs, options);
      expect(result.tools).toEqual(["mamba=1.5.0"]);
      expect(result.options.useMamba).toBe(true);
    });

    it("returns empty tools when mambaVersion is empty (installer-provided)", async () => {
      const inputs = makeInputs({ mambaVersion: "" });
      const options = makeOptions({ mambaInInstaller: true });
      const result = await updateMamba.toolPackages(inputs, options);
      expect(result.tools).toEqual([]);
      expect(result.options.useMamba).toBe(true);
    });

    it("passes through version spec operators", async () => {
      const inputs = makeInputs({ mambaVersion: ">=1.5" });
      const result = await updateMamba.toolPackages(inputs, makeOptions());
      expect(result.tools).toEqual(["mamba>=1.5"]);
    });

    it("sets useMamba to true in returned options", async () => {
      const inputs = makeInputs({ mambaVersion: "1.5.0" });
      const options = makeOptions({ useMamba: false });
      const result = await updateMamba.toolPackages(inputs, options);
      expect(result.options.useMamba).toBe(true);
    });

    it("preserves other options while setting useMamba", async () => {
      const inputs = makeInputs({ mambaVersion: "1.5.0" });
      const options = makeOptions({
        useBundled: false,
        mambaInInstaller: true,
      });
      const result = await updateMamba.toolPackages(inputs, options);
      expect(result.options.useBundled).toBe(false);
      expect(result.options.mambaInInstaller).toBe(true);
      expect(result.options.useMamba).toBe(true);
    });
  });

  describe("postInstall (Unix)", () => {
    it("creates symlink when condabin location does not exist", async () => {
      mockExistsSync.mockReturnValue(false);
      const inputs = makeInputs({ mambaVersion: "2.0.0" });
      const options = makeOptions();

      await updateMamba.postInstall!(inputs, options);

      // condaExecutable returns "/opt/conda/bin/mamba" (first arg)
      // condabinLocation is path.join(condaBasePath, "condabin", basename(exe))
      // which uses platform separators
      const pathMod = await import("path");
      const expectedDest = pathMod.join("/opt/conda", "condabin", "mamba");
      expect(mockSymlinkSync).toHaveBeenCalledWith(
        "/opt/conda/bin/mamba",
        expectedDest,
      );
    });

    it("does not create symlink when condabin location already exists", async () => {
      mockExistsSync.mockReturnValue(true);
      const inputs = makeInputs({ mambaVersion: "2.0.0" });
      const options = makeOptions();

      await updateMamba.postInstall!(inputs, options);

      expect(mockSymlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("postInstall (Windows)", async () => {
    let updateMambaWin: types.IToolProvider;

    beforeEach(async () => {
      vi.resetModules();
      mockExistsSync.mockReset().mockReturnValue(true);
      mockSymlinkSync.mockReset();
      mockWriteFileSync.mockReset();
      mockInfo.mockReset();
      mockCondaExecutable
        .mockReset()
        .mockReturnValue("C:\\conda\\condabin\\mamba.exe");
      mockCondaBasePath.mockReset().mockReturnValue("C:\\conda");

      // Re-mock constants for Windows
      vi.doMock("../../constants", () => ({
        IS_UNIX: false,
        IS_WINDOWS: true,
        IS_MAC: false,
        IS_LINUX: false,
        MINICONDA_DIR_PATH: "C:\\conda",
      }));

      const mod = await import("../../base-tools/update-mamba");
      updateMambaWin = mod.updateMamba;
    });

    it("creates bash wrapper for mamba on Windows", async () => {
      const inputs = makeInputs({ mambaVersion: "2.0.0" });
      const options = makeOptions();

      await updateMambaWin.postInstall!(inputs, options);

      // Should write bash-less forwarder — check the content, not exact path
      // (path.join on macOS produces mixed separators for Windows-style paths)
      expect(mockWriteFileSync).toHaveBeenCalled();
      const call = mockWriteFileSync.mock.calls[0];
      expect(call[1]).toContain("cmd.exe /C CALL");
    });

    it("creates .bat wrapper when mamba.bat does not exist on Windows", async () => {
      // In the Windows branch, existsSync is only called for mambaBat — return false
      mockExistsSync.mockReturnValue(false);

      const inputs = makeInputs({ mambaVersion: "2.0.0" });
      const options = makeOptions();

      await updateMambaWin.postInstall!(inputs, options);

      // Should write both the bash forwarder and the .bat
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
      const batCall = mockWriteFileSync.mock.calls.find(
        (call: any[]) =>
          typeof call[1] === "string" &&
          (call[1] as string).includes("MAMBA_EXES"),
      );
      expect(batCall).toBeDefined();
    });

    it("does not create .bat wrapper when mamba.bat already exists on Windows", async () => {
      // Both existsSync calls return true
      mockExistsSync.mockReturnValue(true);

      const inputs = makeInputs({ mambaVersion: "2.0.0" });
      const options = makeOptions();

      await updateMambaWin.postInstall!(inputs, options);

      // Should only write the bash forwarder, not the .bat
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockWriteFileSync.mock.calls[0][0]).not.toContain(".bat");
    });
  });

  it("has the correct label", () => {
    expect(updateMamba.label).toBe("update mamba");
  });

  it("defines postInstall", () => {
    expect(updateMamba.postInstall).toBeDefined();
    expect(typeof updateMamba.postInstall).toBe("function");
  });
});

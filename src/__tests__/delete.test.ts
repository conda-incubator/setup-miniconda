import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted before any imports) ──────────────────────────────────

const mockExistsSync = vi.fn();
const mockLstatSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockRenameSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: mockExistsSync,
  lstatSync: mockLstatSync,
  readdirSync: mockReaddirSync,
  renameSync: mockRenameSync,
  mkdirSync: mockMkdirSync,
}));

const mockGroup = vi.fn();
const mockStartGroup = vi.fn();
const mockEndGroup = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();
const mockSetFailed = vi.fn();

vi.mock("@actions/core", () => ({
  group: mockGroup,
  startGroup: mockStartGroup,
  endGroup: mockEndGroup,
  info: mockInfo,
  warning: mockWarning,
  setFailed: mockSetFailed,
}));

const mockRmRF = vi.fn();

vi.mock("@actions/io", () => ({
  rmRF: mockRmRF,
}));

const mockParseInputs = vi.fn();

vi.mock("../input", () => ({
  parseInputs: mockParseInputs,
}));

const mockParsePkgsDirs = vi.fn();

vi.mock("../utils", () => ({
  parsePkgsDirs: mockParsePkgsDirs,
}));

// ── Helpers ─────────────────────────────────────────────────────────────

function makeInputs(pkgsDirs: string = "") {
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
      channels: "",
      default_activation_env: "",
      show_channel_urls: "",
      use_only_tar_bz2: "",
      always_yes: "true",
      changeps1: "false",
      solver: "",
      pkgs_dirs: pkgsDirs,
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("delete / run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGroup.mockImplementation(
      async (_msg: string, fn: () => Promise<unknown>) => fn(),
    );
  });

  it("returns early when pkgsDirs is empty", async () => {
    const inputs = makeInputs();
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([]);

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockParsePkgsDirs).toHaveBeenCalledWith(
      inputs.condaConfig.pkgs_dirs,
    );
    expect(mockStartGroup).not.toHaveBeenCalled();
    expect(mockEndGroup).not.toHaveBeenCalled();
  });

  it("skips a pkgsDir that does not exist", async () => {
    const inputs = makeInputs("/nonexistent/pkgs");
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue(["/nonexistent/pkgs"]);
    mockExistsSync.mockReturnValue(false);

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStartGroup).toHaveBeenCalled();
    expect(mockEndGroup).toHaveBeenCalled();
    expect(mockRenameSync).not.toHaveBeenCalled();
  });

  it("skips a pkgsDir whose lstat says it is not a directory", async () => {
    const inputs = makeInputs("/some/file");
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue(["/some/file"]);
    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockReturnValue({ isDirectory: () => false });

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRenameSync).not.toHaveBeenCalled();
  });

  it("stashes directories, skips files, and skips the 'cache' folder", async () => {
    const pathMod = await import("path");
    const pkgsDir =
      process.platform === "win32" ? "C:\\mock\\pkgs" : "/mock/pkgs";
    const inputs = makeInputs(pkgsDir);
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([pkgsDir]);

    const tarFile = pathMod.join(pkgsDir, "some-file.tar.bz2");

    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockImplementation((p: unknown) => {
      if (String(p) === tarFile) return { isDirectory: () => false };
      return { isDirectory: () => true };
    });
    // First readdirSync call is for the parent dir (old stash cleanup),
    // second is for pkgsDir entries
    const parentDir = pathMod.dirname(pathMod.resolve(pkgsDir));
    mockReaddirSync.mockImplementation((p: unknown) => {
      if (String(p) === parentDir) return [pathMod.basename(pkgsDir)];
      return ["numpy-1.21", "cache", "some-file.tar.bz2", "scipy-1.7"];
    });

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should have created a stash directory
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("_stash_"),
      { recursive: true },
    );

    // Should rename numpy-1.21 and scipy-1.7 to stash
    expect(mockRenameSync).toHaveBeenCalledTimes(2);
    expect(mockRenameSync).toHaveBeenCalledWith(
      pathMod.join(pathMod.resolve(pkgsDir), "numpy-1.21"),
      expect.stringContaining("numpy-1.21"),
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      pathMod.join(pathMod.resolve(pkgsDir), "scipy-1.7"),
      expect.stringContaining("scipy-1.7"),
    );

    // Should have logged stash info for the two dirs
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining("numpy-1.21"),
    );
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("scipy-1.7"));

    expect(mockEndGroup).toHaveBeenCalled();
  });

  it("warns when renameSync fails for a package", async () => {
    const pathMod = await import("path");
    const pkgsDir =
      process.platform === "win32" ? "C:\\mock\\pkgs" : "/mock/pkgs";
    const inputs = makeInputs(pkgsDir);
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([pkgsDir]);

    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockReturnValue({ isDirectory: () => true });

    const parentDir = pathMod.dirname(pathMod.resolve(pkgsDir));
    mockReaddirSync.mockImplementation((p: unknown) => {
      if (String(p) === parentDir) return [pathMod.basename(pkgsDir)];
      return ["stubborn-pkg"];
    });
    mockRenameSync.mockImplementation(() => {
      throw new Error("EBUSY");
    });

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("Could not stash"),
    );
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("EBUSY"));
  });

  it("cleans up old stash directories from previous runs", async () => {
    const pathMod = await import("path");
    const pkgsDir =
      process.platform === "win32" ? "C:\\mock\\pkgs" : "/mock/pkgs";
    const inputs = makeInputs(pkgsDir);
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([pkgsDir]);

    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockReturnValue({ isDirectory: () => true });

    const resolvedPkgsDir = pathMod.resolve(pkgsDir);
    const parentDir = pathMod.dirname(resolvedPkgsDir);
    const baseName = pathMod.basename(resolvedPkgsDir);
    const oldStashName = `${baseName}_stash_1234567890`;

    mockReaddirSync.mockImplementation((p: unknown) => {
      if (String(p) === parentDir) return [baseName, oldStashName];
      return [];
    });
    mockRmRF.mockResolvedValue(undefined);

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRmRF).toHaveBeenCalledWith(
      pathMod.join(parentDir, oldStashName),
    );
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining("Cleaning up old stash"),
    );
  });

  it("calls core.setFailed when run encounters an error", async () => {
    const errorMsg = "Something went wrong";
    mockGroup.mockRejectedValue(new Error(errorMsg));

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSetFailed).toHaveBeenCalledWith(errorMsg);
  });
});

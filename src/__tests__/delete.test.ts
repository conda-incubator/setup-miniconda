import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted before any imports) ──────────────────────────────────

const mockExistsSync = vi.fn();
const mockLstatSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: mockExistsSync,
  lstatSync: mockLstatSync,
  readdirSync: mockReaddirSync,
}));

vi.mock("os", () => ({
  tmpdir: vi.fn(() => "/tmp"),
}));

const mockGroup = vi.fn();
const mockStartGroup = vi.fn();
const mockEndGroup = vi.fn();
const mockInfo = vi.fn();
const mockSetFailed = vi.fn();

vi.mock("@actions/core", () => ({
  group: mockGroup,
  startGroup: mockStartGroup,
  endGroup: mockEndGroup,
  info: mockInfo,
  setFailed: mockSetFailed,
}));

const mockRmRF = vi.fn();
const mockMv = vi.fn();

vi.mock("@actions/io", () => ({
  rmRF: mockRmRF,
  mv: mockMv,
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
    // Default: core.group invokes the callback and returns its result
    mockGroup.mockImplementation(
      async (_msg: string, fn: () => Promise<unknown>) => fn(),
    );
  });

  it("returns early when pkgsDirs is empty", async () => {
    const inputs = makeInputs();
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([]);

    // Importing the module triggers `void run()` as a side effect.
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
    expect(mockReaddirSync).not.toHaveBeenCalled();
    expect(mockRmRF).not.toHaveBeenCalled();
  });

  it("skips a pkgsDir whose lstat says it is not a directory", async () => {
    const inputs = makeInputs("/some/file");
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue(["/some/file"]);
    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockReturnValue({ isDirectory: () => false });

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockReaddirSync).not.toHaveBeenCalled();
    expect(mockRmRF).not.toHaveBeenCalled();
  });

  it("removes directories, skips files, and skips the 'cache' folder", async () => {
    const pathMod = await import("path");
    // Use a platform-appropriate mock path to avoid path.join separator issues
    const pkgsDir =
      process.platform === "win32" ? "C:\\mock\\pkgs" : "/mock/pkgs";
    const inputs = makeInputs(pkgsDir);
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([pkgsDir]);

    const tarFile = pathMod.join(pkgsDir, "some-file.tar.bz2");

    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockImplementation((p: unknown) => {
      // The .tar.bz2 is a file, everything else is a directory
      if (String(p) === tarFile) return { isDirectory: () => false };
      return { isDirectory: () => true };
    });
    mockReaddirSync.mockReturnValue([
      "numpy-1.21",
      "cache",
      "some-file.tar.bz2",
      "scipy-1.7",
    ]);
    mockRmRF.mockResolvedValue(undefined);

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const numpyPath = pathMod.join(pkgsDir, "numpy-1.21");
    const scipyPath = pathMod.join(pkgsDir, "scipy-1.7");
    const cachePath = pathMod.join(pkgsDir, "cache");
    const filePath = pathMod.join(pkgsDir, "some-file.tar.bz2");

    // Should remove numpy-1.21 and scipy-1.7
    expect(mockRmRF).toHaveBeenCalledTimes(2);
    expect(mockRmRF).toHaveBeenCalledWith(numpyPath);
    expect(mockRmRF).toHaveBeenCalledWith(scipyPath);

    // Should NOT have tried to remove "cache" or the file
    expect(mockRmRF).not.toHaveBeenCalledWith(cachePath);
    expect(mockRmRF).not.toHaveBeenCalledWith(filePath);

    // Should have logged info for the two removed dirs
    expect(mockInfo).toHaveBeenCalledWith(`Removing "${numpyPath}"`);
    expect(mockInfo).toHaveBeenCalledWith(`Removing "${scipyPath}"`);

    expect(mockEndGroup).toHaveBeenCalled();
  });

  it("falls back to io.mv when rmRF fails", async () => {
    const pathMod = await import("path");
    const pkgsDir =
      process.platform === "win32" ? "C:\\mock\\pkgs" : "/mock/pkgs";
    const inputs = makeInputs(pkgsDir);
    mockParseInputs.mockResolvedValue(inputs);
    mockParsePkgsDirs.mockReturnValue([pkgsDir]);

    mockExistsSync.mockReturnValue(true);
    mockLstatSync.mockImplementation(() => ({
      isDirectory: () => true,
    }));
    mockReaddirSync.mockReturnValue(["stubborn-pkg"]);
    mockRmRF.mockRejectedValue(new Error("EBUSY"));
    mockMv.mockResolvedValue(undefined);

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const expectedPath = pathMod.join(pkgsDir, "stubborn-pkg");
    expect(mockRmRF).toHaveBeenCalledWith(expectedPath);
    expect(mockInfo).toHaveBeenCalledWith(
      `Remove failed, moving "${expectedPath}" to temp folder`,
    );
    const expectedDest = pathMod.join("/tmp", "stubborn-pkg");
    expect(mockMv).toHaveBeenCalledWith(expectedPath, expectedDest);
  });

  it("calls core.setFailed when run encounters an error", async () => {
    const errorMsg = "Something went wrong";
    mockGroup.mockRejectedValue(new Error(errorMsg));

    await import("../delete");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSetFailed).toHaveBeenCalledWith(errorMsg);
  });
});

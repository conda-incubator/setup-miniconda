import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers to drive core.getInput() per-test
// ---------------------------------------------------------------------------
let inputMap: Record<string, string> = {};

function setInput(name: string, value: string) {
  inputMap[name] = value;
}

function setDefaults() {
  inputMap = {
    architecture: "",
    "auto-activate-base": "legacy-placeholder",
    "activate-environment": "test",
    "conda-build-version": "",
    "condarc-file": "",
    "conda-version": "",
    "environment-file": "",
    "installer-url": "",
    "installation-dir": "",
    "mamba-version": "",
    "use-mamba": "",
    "miniconda-version": "",
    "miniforge-variant": "",
    "miniforge-version": "",
    "conda-remove-defaults": "false",
    "python-version": "",
    "remove-profiles": "true",
    "run-init": "true",
    "add-anaconda-token": "",
    "add-pip-as-python-dependency": "",
    "allow-softlinks": "",
    "auto-activate": "false",
    "auto-update-conda": "false",
    "channel-alias": "",
    "channel-priority": "strict",
    channels: "conda-forge",
    "show-channel-urls": "",
    "use-only-tar-bz2": "",
    "conda-solver": "",
    "pkgs-dirs": "",
    "clean-patched-environment-file": "true",
    "run-post": "true",
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@actions/core", () => ({
  getInput: vi.fn((name: string) => inputMap[name] ?? ""),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  isDebug: vi.fn(() => false),
  exportVariable: vi.fn(),
}));

vi.mock("semver", () => ({
  lt: vi.fn((a: string, b: string) => {
    // Minimal semver.lt for the tests we need
    const parse = (v: string) => v.split(".").map(Number);
    const [aMaj, aMin, aPat] = parse(a);
    const [bMaj, bMin, bPat] = parse(b);
    if (aMaj !== bMaj) return aMaj < bMaj;
    if (aMin !== bMin) return aMin < bMin;
    return aPat < bPat;
  }),
}));

// Provide stable values for platform booleans so tests are deterministic
vi.mock("../constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../constants")>();
  return {
    ...actual,
    IS_LINUX: false,
    IS_WINDOWS: false,
    IS_MAC: true,
    IS_UNIX: true,
  };
});

// We need access to the mocked core to assert on calls
import * as core from "@actions/core";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("parseInputs", () => {
  beforeEach(async () => {
    setDefaults();
    vi.clearAllMocks();
    // Reset the module so each test gets a fresh import (rules evaluated fresh)
    vi.resetModules();
  });

  // Helper: import parseInputs fresh after resetModules
  async function loadParseInputs() {
    const mod = await import("../input");
    return mod.parseInputs;
  }

  // -----------------------------------------------------------------------
  // Default / minimal inputs
  // -----------------------------------------------------------------------
  describe("default / minimal inputs", () => {
    it("parses minimal defaults without throwing", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.activateEnvironment).toBe("test");
      expect(result.condaVersion).toBe("");
      expect(result.minicondaVersion).toBe("");
      expect(result.miniforgeVersion).toBe("");
      expect(result.installerUrl).toBe("");
      expect(result.pythonVersion).toBe("");
      expect(result.runPost).toBe("true");
    });

    it("exports INPUT_RUN_POST variable", async () => {
      const parseInputs = await loadParseInputs();
      await parseInputs();

      expect(core.exportVariable).toHaveBeenCalledWith(
        "INPUT_RUN_POST",
        "true",
      );
    });

    it("sets always_yes and changeps1 in condaConfig", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.always_yes).toBe("true");
      expect(result.condaConfig.changeps1).toBe("false");
    });

    it("reads channels from input", async () => {
      setInput("channels", "conda-forge,bioconda");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.channels).toBe("conda-forge,bioconda");
    });

    it("reads conda-solver from input", async () => {
      setInput("conda-solver", "libmamba");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.solver).toBe("libmamba");
    });

    it("reads channel-priority from input", async () => {
      setInput("channel-priority", "flexible");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.channel_priority).toBe("flexible");
    });

    it("reads pkgs-dirs from input", async () => {
      setInput("pkgs-dirs", "/my/pkgs");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.pkgs_dirs).toBe("/my/pkgs");
    });

    it("sets default_activation_env to empty string", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.default_activation_env).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // Architecture handling
  // -----------------------------------------------------------------------
  describe("architecture", () => {
    it("uses process.arch when architecture input is empty", async () => {
      setInput("architecture", "");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.architecture).toBe(process.arch);
    });

    it("uses provided architecture input", async () => {
      setInput("architecture", "x64");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.architecture).toBe("x64");
    });

    it("converts arm64 to aarch64 on Linux", async () => {
      // Override constants to simulate Linux
      vi.doMock("../constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("../constants")>();
        return {
          ...actual,
          IS_LINUX: true,
          IS_WINDOWS: false,
          IS_MAC: false,
          IS_UNIX: true,
        };
      });
      setInput("architecture", "arm64");
      const mod = await import("../input");
      const result = await mod.parseInputs();

      expect(result.architecture).toBe("aarch64");
    });

    it("does NOT convert arm64 on non-Linux", async () => {
      // Explicitly re-mock constants to ensure IS_LINUX is false
      // (previous test's vi.doMock with IS_LINUX=true may bleed)
      vi.doMock("../constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("../constants")>();
        return {
          ...actual,
          IS_LINUX: false,
          IS_WINDOWS: false,
          IS_MAC: true,
          IS_UNIX: true,
        };
      });
      setInput("architecture", "arm64");
      const mod = await import("../input");
      const result = await mod.parseInputs();

      // IS_LINUX=false, so arm64 stays arm64
      expect(result.architecture).toBe("arm64");
    });
  });

  // -----------------------------------------------------------------------
  // auto-activate-base deprecation warning
  // -----------------------------------------------------------------------
  describe("auto-activate-base deprecation", () => {
    it("fires deprecation warning when auto-activate-base is NOT legacy-placeholder", async () => {
      setInput("auto-activate-base", "true");
      const parseInputs = await loadParseInputs();
      await parseInputs();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("`auto-activate-base` is deprecated"),
      );
    });

    it("does NOT fire deprecation warning when auto-activate-base is legacy-placeholder", async () => {
      setInput("auto-activate-base", "legacy-placeholder");
      const parseInputs = await loadParseInputs();
      await parseInputs();

      // The first call should NOT be the deprecation warning
      const warningCalls = vi.mocked(core.warning).mock.calls;
      const hasDeprecation = warningCalls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("`auto-activate-base` is deprecated"),
      );
      expect(hasDeprecation).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // activate-environment + auto-activate-base interaction
  // -----------------------------------------------------------------------
  describe("activateEnvironment resolution", () => {
    it("uses 'base' when auto-activate-base=true and activate-environment is empty", async () => {
      setInput("auto-activate-base", "true");
      setInput("activate-environment", "");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.activateEnvironment).toBe("base");
    });

    it("uses activate-environment when auto-activate-base=true but activate-environment is set", async () => {
      setInput("auto-activate-base", "true");
      setInput("activate-environment", "myenv");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.activateEnvironment).toBe("myenv");
    });

    it("uses activate-environment when auto-activate-base=false", async () => {
      setInput("auto-activate-base", "false");
      setInput("activate-environment", "myenv");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.activateEnvironment).toBe("myenv");
    });

    it("uses empty string when auto-activate-base=false and activate-environment is empty", async () => {
      setInput("auto-activate-base", "false");
      setInput("activate-environment", "");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.activateEnvironment).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // auto_activate condaConfig resolution
  // -----------------------------------------------------------------------
  describe("condaConfig.auto_activate", () => {
    it("uses auto-activate input when auto-activate-base is legacy-placeholder", async () => {
      setInput("auto-activate-base", "legacy-placeholder");
      setInput("auto-activate", "true");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.auto_activate).toBe("true");
    });

    it("uses auto-activate-base value when it is NOT legacy-placeholder", async () => {
      setInput("auto-activate-base", "false");
      setInput("auto-activate", "true");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.auto_activate).toBe("false");
    });
  });

  // -----------------------------------------------------------------------
  // Mambaforge deprecation
  // -----------------------------------------------------------------------
  describe("Mambaforge deprecation warning", () => {
    it("fires warning for miniforge-variant=Mambaforge", async () => {
      setInput("miniforge-variant", "Mambaforge");
      setInput("miniforge-version", "latest");
      const parseInputs = await loadParseInputs();
      await parseInputs();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("'Mambaforge' variants are now equivalent"),
      );
    });

    it("fires warning for miniforge-variant=Mambaforge-pypy3", async () => {
      setInput("miniforge-variant", "Mambaforge-pypy3");
      setInput("miniforge-version", "latest");
      const parseInputs = await loadParseInputs();
      await parseInputs();

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining("'Mambaforge' variants are now equivalent"),
      );
    });

    it("does NOT fire warning for Miniforge3", async () => {
      setInput("miniforge-variant", "Miniforge3");
      setInput("miniforge-version", "latest");
      const parseInputs = await loadParseInputs();
      await parseInputs();

      const warningCalls = vi.mocked(core.warning).mock.calls;
      const hasMambaforgeWarning = warningCalls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("'Mambaforge' variants are now equivalent"),
      );
      expect(hasMambaforgeWarning).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // condaRemoveDefaults
  // -----------------------------------------------------------------------
  describe("condaRemoveDefaults", () => {
    it("reads conda-remove-defaults from input", async () => {
      setInput("conda-remove-defaults", "true");
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaRemoveDefaults).toBe("true");
    });

    it("defaults to false", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaRemoveDefaults).toBe("false");
    });
  });

  // -----------------------------------------------------------------------
  // Debug logging
  // -----------------------------------------------------------------------
  describe("debug mode", () => {
    it("logs inputs JSON when isDebug is true", async () => {
      vi.mocked(core.isDebug).mockReturnValue(true);
      const parseInputs = await loadParseInputs();
      await parseInputs();

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining("activateEnvironment"),
      );
    });

    it("does NOT log inputs JSON when isDebug is false", async () => {
      vi.mocked(core.isDebug).mockReturnValue(false);
      const parseInputs = await loadParseInputs();
      await parseInputs();

      const infoCalls = vi.mocked(core.info).mock.calls;
      const hasJsonDump = infoCalls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("activateEnvironment"),
      );
      expect(hasJsonDump).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Validation RULES
  // -----------------------------------------------------------------------
  describe("validation rules", () => {
    it("throws when conda-version AND auto-update-conda=true", async () => {
      setInput("conda-version", "4.8.0");
      setInput("auto-update-conda", "true");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("only one of 'conda-version"),
      );
    });

    it("does NOT throw when conda-version set without auto-update-conda", async () => {
      setInput("conda-version", "4.8.0");
      setInput("auto-update-conda", "false");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("throws when python-version set without activate-environment", async () => {
      setInput("python-version", "3.9");
      setInput("activate-environment", "");
      setInput("auto-activate-base", "legacy-placeholder");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "'python-version: 3.9' requires 'activate-environment'",
        ),
      );
    });

    it("does NOT throw when python-version set WITH activate-environment", async () => {
      setInput("python-version", "3.9");
      setInput("activate-environment", "myenv");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("throws when miniconda-version AND miniforge-version both set", async () => {
      setInput("miniconda-version", "latest");
      setInput("miniforge-version", "latest");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("only one of 'miniconda-version"),
      );
    });

    it("throws when installer-url AND miniconda-version both set", async () => {
      setInput("installer-url", "https://example.com/installer.sh");
      setInput("miniconda-version", "latest");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("only one of 'installer-url"),
      );
    });

    it("throws when installer-url AND miniforge-version both set", async () => {
      setInput("installer-url", "https://example.com/installer.sh");
      setInput("miniforge-version", "latest");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("only one of 'installer-url"),
      );
    });

    it("throws when installer-url has unknown extension", async () => {
      setInput("installer-url", "https://example.com/installer.pkg");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("'installer-url' extension '.pkg'"),
      );
    });

    it("does NOT throw for installer-url with .sh extension", async () => {
      setInput("installer-url", "https://example.com/installer.sh");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("does NOT throw for installer-url with .exe extension", async () => {
      setInput("installer-url", "https://example.com/installer.exe");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("throws when architecture=x86 on non-Windows", async () => {
      // Default mock: IS_WINDOWS=false
      setInput("architecture", "x86");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining("'architecture: x86' is only available"),
      );
    });

    it("does NOT throw when architecture=x86 on Windows", async () => {
      vi.doMock("../constants", async (importOriginal) => {
        const actual = await importOriginal<typeof import("../constants")>();
        return {
          ...actual,
          IS_LINUX: false,
          IS_WINDOWS: true,
          IS_MAC: false,
          IS_UNIX: false,
        };
      });
      setInput("architecture", "x86");
      const mod = await import("../input");

      await expect(mod.parseInputs()).resolves.toBeDefined();
    });

    it("throws when miniconda-version < 4.6.0", async () => {
      setInput("miniconda-version", "4.5.0");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('requires "miniconda-version">=4.6'),
      );
    });

    it("does NOT throw for miniconda-version=latest", async () => {
      setInput("miniconda-version", "latest");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("does NOT throw for miniconda-version >= 4.6.0", async () => {
      setInput("miniconda-version", "4.8.3");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("strips py prefix for miniconda-version semver check", async () => {
      // py38_4.5.0 should normalize to 4.5.0, which is < 4.6.0
      setInput("miniconda-version", "py38_4.5.0");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "errors found in action inputs",
      );
    });

    it("does NOT throw for py-prefixed version >= 4.6.0", async () => {
      setInput("miniconda-version", "py39_4.9.2");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).resolves.toBeDefined();
    });

    it("reports multiple errors at once", async () => {
      setInput("conda-version", "4.8.0");
      setInput("auto-update-conda", "true");
      setInput("python-version", "3.9");
      setInput("activate-environment", "");
      setInput("auto-activate-base", "legacy-placeholder");
      const parseInputs = await loadParseInputs();

      await expect(parseInputs()).rejects.toThrow(
        "2 errors found in action inputs",
      );
      expect(vi.mocked(core.error).mock.calls.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // All conda config fields are read from inputs
  // -----------------------------------------------------------------------
  describe("condaConfig fields mapped from inputs", () => {
    it("maps all conda config inputs correctly", async () => {
      setInput("add-anaconda-token", "true");
      setInput("add-pip-as-python-dependency", "true");
      setInput("allow-softlinks", "true");
      setInput("auto-update-conda", "false");
      setInput("channel-alias", "https://my.channel");
      setInput("channel-priority", "flexible");
      setInput("channels", "defaults,conda-forge");
      setInput("show-channel-urls", "true");
      setInput("use-only-tar-bz2", "true");
      setInput("conda-solver", "classic");
      setInput("pkgs-dirs", "/custom/pkgs");

      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaConfig.add_anaconda_token).toBe("true");
      expect(result.condaConfig.add_pip_as_python_dependency).toBe("true");
      expect(result.condaConfig.allow_softlinks).toBe("true");
      expect(result.condaConfig.auto_update_conda).toBe("false");
      expect(result.condaConfig.channel_alias).toBe("https://my.channel");
      expect(result.condaConfig.channel_priority).toBe("flexible");
      expect(result.condaConfig.channels).toBe("defaults,conda-forge");
      expect(result.condaConfig.show_channel_urls).toBe("true");
      expect(result.condaConfig.use_only_tar_bz2).toBe("true");
      expect(result.condaConfig.solver).toBe("classic");
      expect(result.condaConfig.pkgs_dirs).toBe("/custom/pkgs");
    });
  });

  // -----------------------------------------------------------------------
  // All top-level action input fields
  // -----------------------------------------------------------------------
  describe("top-level input fields", () => {
    it("reads all remaining string fields from core.getInput", async () => {
      setInput("conda-build-version", "3.21.0");
      setInput("condarc-file", "/path/to/.condarc");
      setInput("environment-file", "environment.yml");
      setInput("installation-dir", "/opt/conda");
      setInput("mamba-version", "0.27.0");
      setInput("use-mamba", "true");
      setInput("remove-profiles", "false");
      setInput("run-init", "false");
      setInput("clean-patched-environment-file", "false");
      setInput("run-post", "false");

      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(result.condaBuildVersion).toBe("3.21.0");
      expect(result.condaConfigFile).toBe("/path/to/.condarc");
      expect(result.environmentFile).toBe("environment.yml");
      expect(result.installationDir).toBe("/opt/conda");
      expect(result.mambaVersion).toBe("0.27.0");
      expect(result.useMamba).toBe("true");
      expect(result.removeProfiles).toBe("false");
      expect(result.runInit).toBe("false");
      expect(result.cleanPatchedEnvironmentFile).toBe("false");
      expect(result.runPost).toBe("false");
    });
  });

  // -----------------------------------------------------------------------
  // Result is frozen
  // -----------------------------------------------------------------------
  describe("immutability", () => {
    it("returns a frozen object", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(Object.isFrozen(result)).toBe(true);
    });

    it("returns frozen condaConfig", async () => {
      const parseInputs = await loadParseInputs();
      const result = await parseInputs();

      expect(Object.isFrozen(result.condaConfig)).toBe(true);
    });
  });
});

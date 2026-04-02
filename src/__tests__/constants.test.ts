import { describe, it, expect, vi } from "vitest";

// Mock os and path before importing constants
vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return {
    ...actual,
    homedir: vi.fn(() => "/mock/home"),
  };
});

import {
  MINICONDA_DIR_PATH,
  IS_WINDOWS,
  IS_MAC,
  IS_LINUX,
  IS_UNIX,
  MINICONDA_BASE_URL,
  MINICONDA_ARCHITECTURES,
  MINIFORGE_ARCHITECTURES,
  OS_NAMES,
  MINIFORGE_URL_PREFIX,
  MINIFORGE_DEFAULT_VARIANT,
  MINIFORGE_DEFAULT_VERSION,
  BASE_ENV_NAMES,
  KNOWN_EXTENSIONS,
  MAMBA_SUBCOMMANDS,
  IGNORED_WARNINGS,
  FORCED_ERRORS,
  BOOTSTRAP_CONDARC,
  CONDARC_PATH,
  DEFAULT_PKGS_DIR,
  PROFILES,
  WIN_PERMS_FOLDERS,
  PYTHON_SPEC,
  OUTPUT_ENV_FILE_PATH,
  OUTPUT_ENV_FILE_CONTENT,
  OUTPUT_ENV_FILE_WAS_PATCHED,
} from "../constants";

// ---------------------------------------------------------------------------
// Platform booleans
// ---------------------------------------------------------------------------
describe("Platform booleans", () => {
  it("IS_WINDOWS is a boolean", () => {
    expect(typeof IS_WINDOWS).toBe("boolean");
  });

  it("IS_MAC is a boolean", () => {
    expect(typeof IS_MAC).toBe("boolean");
  });

  it("IS_LINUX is a boolean", () => {
    expect(typeof IS_LINUX).toBe("boolean");
  });

  it("IS_UNIX is a boolean", () => {
    expect(typeof IS_UNIX).toBe("boolean");
  });

  it("IS_UNIX equals IS_MAC || IS_LINUX", () => {
    expect(IS_UNIX).toBe(IS_MAC || IS_LINUX);
  });

  it("exactly one of IS_WINDOWS, IS_MAC, IS_LINUX is true", () => {
    const trueCount = [IS_WINDOWS, IS_MAC, IS_LINUX].filter(Boolean).length;
    // On a given platform exactly one should be true, or none if on an exotic
    // platform, but never more than one.
    expect(trueCount).toBeLessThanOrEqual(1);
  });

  it("IS_WINDOWS and IS_UNIX are mutually exclusive", () => {
    expect(IS_WINDOWS && IS_UNIX).toBe(false);
  });

  // Coverage note for line 13: `IS_UNIX = IS_MAC || IS_LINUX`
  // On macOS, IS_MAC is true so JS short-circuits the || and IS_LINUX is
  // never evaluated — leaving the false-branch of || uncovered.
  // On Linux, IS_MAC is false so IS_LINUX is evaluated — covering both branches.
  // On Windows, both are false so IS_UNIX is false — covering the overall false case.
  // This is a platform-dependent branch that cannot be fully covered in a
  // single CI run.  The test below validates the logical equivalence holds
  // regardless of which platform we are on.
  it("IS_UNIX is true if and only if the platform is darwin or linux (line 13 branch note)", () => {
    const platform = process.platform;
    if (platform === "darwin") {
      expect(IS_MAC).toBe(true);
      expect(IS_UNIX).toBe(true);
    } else if (platform === "linux") {
      expect(IS_LINUX).toBe(true);
      expect(IS_UNIX).toBe(true);
    } else {
      expect(IS_UNIX).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// MINICONDA_DIR_PATH
// ---------------------------------------------------------------------------
describe("MINICONDA_DIR_PATH", () => {
  it("is a string", () => {
    expect(typeof MINICONDA_DIR_PATH).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// MINICONDA_BASE_URL
// ---------------------------------------------------------------------------
describe("MINICONDA_BASE_URL", () => {
  it("points to the Anaconda miniconda repo", () => {
    expect(MINICONDA_BASE_URL).toBe("https://repo.anaconda.com/miniconda/");
  });

  it("ends with a trailing slash", () => {
    expect(MINICONDA_BASE_URL.endsWith("/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MINICONDA_ARCHITECTURES
// ---------------------------------------------------------------------------
describe("MINICONDA_ARCHITECTURES", () => {
  it("is an object with string values", () => {
    expect(typeof MINICONDA_ARCHITECTURES).toBe("object");
    for (const value of Object.values(MINICONDA_ARCHITECTURES)) {
      expect(typeof value).toBe("string");
    }
  });

  it("contains expected architecture keys", () => {
    const keys = Object.keys(MINICONDA_ARCHITECTURES);
    expect(keys).toContain("x64");
    expect(keys).toContain("x86_64");
    expect(keys).toContain("aarch64");
    expect(keys).toContain("arm64");
    expect(keys).toContain("x86");
  });

  it("maps x64 to x86_64", () => {
    expect(MINICONDA_ARCHITECTURES["x64"]).toBe("x86_64");
  });

  it("maps arm32 to armv7l", () => {
    expect(MINICONDA_ARCHITECTURES["arm32"]).toBe("armv7l");
  });
});

// ---------------------------------------------------------------------------
// MINIFORGE_ARCHITECTURES
// ---------------------------------------------------------------------------
describe("MINIFORGE_ARCHITECTURES", () => {
  it("is an object with string values", () => {
    expect(typeof MINIFORGE_ARCHITECTURES).toBe("object");
    for (const value of Object.values(MINIFORGE_ARCHITECTURES)) {
      expect(typeof value).toBe("string");
    }
  });

  it("contains expected architecture keys", () => {
    const keys = Object.keys(MINIFORGE_ARCHITECTURES);
    expect(keys).toContain("x64");
    expect(keys).toContain("x86_64");
    expect(keys).toContain("aarch64");
    expect(keys).toContain("arm64");
  });

  it("maps x64 to x86_64", () => {
    expect(MINIFORGE_ARCHITECTURES["x64"]).toBe("x86_64");
  });

  it("is a subset of MINICONDA_ARCHITECTURES keys (all keys exist there)", () => {
    for (const key of Object.keys(MINIFORGE_ARCHITECTURES)) {
      expect(MINICONDA_ARCHITECTURES).toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// OS_NAMES
// ---------------------------------------------------------------------------
describe("OS_NAMES", () => {
  it("maps win32 to Windows", () => {
    expect(OS_NAMES["win32"]).toBe("Windows");
  });

  it("maps darwin to MacOSX", () => {
    expect(OS_NAMES["darwin"]).toBe("MacOSX");
  });

  it("maps linux to Linux", () => {
    expect(OS_NAMES["linux"]).toBe("Linux");
  });

  it("has exactly 3 entries", () => {
    expect(Object.keys(OS_NAMES)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Miniforge defaults
// ---------------------------------------------------------------------------
describe("Miniforge defaults", () => {
  it("MINIFORGE_URL_PREFIX points to conda-forge/miniforge releases", () => {
    expect(MINIFORGE_URL_PREFIX).toBe(
      "https://github.com/conda-forge/miniforge/releases",
    );
  });

  it("MINIFORGE_DEFAULT_VARIANT is Miniforge3", () => {
    expect(MINIFORGE_DEFAULT_VARIANT).toBe("Miniforge3");
  });

  it("MINIFORGE_DEFAULT_VERSION is latest", () => {
    expect(MINIFORGE_DEFAULT_VERSION).toBe("latest");
  });
});

// ---------------------------------------------------------------------------
// BASE_ENV_NAMES
// ---------------------------------------------------------------------------
describe("BASE_ENV_NAMES", () => {
  it("is an array", () => {
    expect(Array.isArray(BASE_ENV_NAMES)).toBe(true);
  });

  it("contains 'base'", () => {
    expect(BASE_ENV_NAMES).toContain("base");
  });

  it("contains 'root'", () => {
    expect(BASE_ENV_NAMES).toContain("root");
  });

  it("contains empty string", () => {
    expect(BASE_ENV_NAMES).toContain("");
  });
});

// ---------------------------------------------------------------------------
// KNOWN_EXTENSIONS
// ---------------------------------------------------------------------------
describe("KNOWN_EXTENSIONS", () => {
  it("is an array", () => {
    expect(Array.isArray(KNOWN_EXTENSIONS)).toBe(true);
  });

  it("contains .exe", () => {
    expect(KNOWN_EXTENSIONS).toContain(".exe");
  });

  it("contains .sh", () => {
    expect(KNOWN_EXTENSIONS).toContain(".sh");
  });

  it("all entries start with a dot", () => {
    for (const ext of KNOWN_EXTENSIONS) {
      expect(ext.startsWith(".")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// MAMBA_SUBCOMMANDS
// ---------------------------------------------------------------------------
describe("MAMBA_SUBCOMMANDS", () => {
  it("is an array of strings", () => {
    expect(Array.isArray(MAMBA_SUBCOMMANDS)).toBe(true);
    for (const cmd of MAMBA_SUBCOMMANDS) {
      expect(typeof cmd).toBe("string");
    }
  });

  it("contains expected subcommands", () => {
    expect(MAMBA_SUBCOMMANDS).toContain("create");
    expect(MAMBA_SUBCOMMANDS).toContain("install");
    expect(MAMBA_SUBCOMMANDS).toContain("clean");
    expect(MAMBA_SUBCOMMANDS).toContain("env");
    expect(MAMBA_SUBCOMMANDS).toContain("info");
    expect(MAMBA_SUBCOMMANDS).toContain("list");
    expect(MAMBA_SUBCOMMANDS).toContain("run");
    expect(MAMBA_SUBCOMMANDS).toContain("search");
  });

  it("has 8 subcommands", () => {
    expect(MAMBA_SUBCOMMANDS).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// IGNORED_WARNINGS
// ---------------------------------------------------------------------------
describe("IGNORED_WARNINGS", () => {
  it("is an array", () => {
    expect(Array.isArray(IGNORED_WARNINGS)).toBe(true);
  });

  it("contains only strings", () => {
    for (const w of IGNORED_WARNINGS) {
      expect(typeof w).toBe("string");
    }
  });

  it("includes menuinst_win32 warning", () => {
    expect(IGNORED_WARNINGS).toContain("menuinst_win32");
  });

  it("includes the bash warning", () => {
    expect(IGNORED_WARNINGS).toContain('Please run using "bash"');
  });

  it("includes cygpath fallback warning", () => {
    expect(IGNORED_WARNINGS.some((w) => w.includes("cygpath"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FORCED_ERRORS
// ---------------------------------------------------------------------------
describe("FORCED_ERRORS", () => {
  it("is an array", () => {
    expect(Array.isArray(FORCED_ERRORS)).toBe(true);
  });

  it("contains only strings", () => {
    for (const e of FORCED_ERRORS) {
      expect(typeof e).toBe("string");
    }
  });

  it("includes EnvironmentSectionNotValid", () => {
    expect(FORCED_ERRORS).toContain("EnvironmentSectionNotValid");
  });
});

// ---------------------------------------------------------------------------
// BOOTSTRAP_CONDARC
// ---------------------------------------------------------------------------
describe("BOOTSTRAP_CONDARC", () => {
  it("is a non-empty string", () => {
    expect(typeof BOOTSTRAP_CONDARC).toBe("string");
    expect(BOOTSTRAP_CONDARC.length).toBeGreaterThan(0);
  });

  it("disables outdated conda notifications", () => {
    expect(BOOTSTRAP_CONDARC).toContain("notify_outdated_conda: false");
  });
});

// ---------------------------------------------------------------------------
// CONDARC_PATH
// ---------------------------------------------------------------------------
describe("CONDARC_PATH", () => {
  it("is a string ending with .condarc", () => {
    expect(typeof CONDARC_PATH).toBe("string");
    expect(CONDARC_PATH.endsWith(".condarc")).toBe(true);
  });

  it("is built from homedir", () => {
    // The os.homedir mock returns /mock/home
    // path.join produces platform-specific separators
    expect(CONDARC_PATH).toContain("mock");
    expect(CONDARC_PATH).toContain("home");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PKGS_DIR
// ---------------------------------------------------------------------------
describe("DEFAULT_PKGS_DIR", () => {
  it("is conda_pkgs_dir", () => {
    expect(DEFAULT_PKGS_DIR).toBe("conda_pkgs_dir");
  });
});

// ---------------------------------------------------------------------------
// PROFILES
// ---------------------------------------------------------------------------
describe("PROFILES", () => {
  it("is an array of strings", () => {
    expect(Array.isArray(PROFILES)).toBe(true);
    for (const p of PROFILES) {
      expect(typeof p).toBe("string");
    }
  });

  it("contains .bashrc", () => {
    expect(PROFILES).toContain(".bashrc");
  });

  it("contains .zshrc", () => {
    expect(PROFILES).toContain(".zshrc");
  });

  it("contains .bash_profile", () => {
    expect(PROFILES).toContain(".bash_profile");
  });

  it("contains fish config", () => {
    expect(PROFILES).toContain(".config/fish/config.fish");
  });

  it("contains powershell profile", () => {
    expect(PROFILES.some((p) => p.includes("powershell/profile.ps1"))).toBe(
      true,
    );
  });

  it("has at least 5 profiles", () => {
    expect(PROFILES.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// WIN_PERMS_FOLDERS
// ---------------------------------------------------------------------------
describe("WIN_PERMS_FOLDERS", () => {
  it("is an array of strings", () => {
    expect(Array.isArray(WIN_PERMS_FOLDERS)).toBe(true);
    for (const f of WIN_PERMS_FOLDERS) {
      expect(typeof f).toBe("string");
    }
  });

  it("contains condabin/", () => {
    expect(WIN_PERMS_FOLDERS).toContain("condabin/");
  });

  it("contains Scripts/", () => {
    expect(WIN_PERMS_FOLDERS).toContain("Scripts/");
  });

  it("contains shell/", () => {
    expect(WIN_PERMS_FOLDERS).toContain("shell/");
  });

  it("contains etc/profile.d/", () => {
    expect(WIN_PERMS_FOLDERS).toContain("etc/profile.d/");
  });
});

// ---------------------------------------------------------------------------
// PYTHON_SPEC regex
// ---------------------------------------------------------------------------
describe("PYTHON_SPEC", () => {
  it("is a RegExp", () => {
    expect(PYTHON_SPEC).toBeInstanceOf(RegExp);
  });

  // --- Should match ---
  it.each([
    ["python", "bare python"],
    ["python=3.9", "version with ="],
    ["python>=3.9", "version with >="],
    ["python>3", "version with >"],
    ["python<4", "version with <"],
    ["python!=2", "version with !="],
    ["python 3.9", "version with space"],
    ["python|3.9", "version with pipe"],
    ["conda-forge::python", "channel-qualified bare"],
    ["conda-forge::python=3.9", "channel-qualified with version"],
    ["defaults::python>=3.10", "defaults channel with version"],
    ["Python", "uppercase Python (case-insensitive)"],
    ["PYTHON=3.9", "all-caps PYTHON"],
  ])('matches "%s" (%s)', (input) => {
    expect(PYTHON_SPEC.test(input)).toBe(true);
  });

  // --- Should NOT match ---
  it.each([
    ["numpy", "unrelated package"],
    ["python-dateutil", "package starting with python-"],
    ["pythonnet", "package starting with python (no delimiter)"],
    ["cython", "package containing ython"],
    ["ipython", "package ending with python"],
    ["biopython", "package ending with python"],
    ["", "empty string"],
    ["numpythonic", "python buried in the middle"],
  ])('does not match "%s" (%s)', (input) => {
    expect(PYTHON_SPEC.test(input)).toBe(false);
  });

  it("is case-insensitive (has i flag)", () => {
    expect(PYTHON_SPEC.flags).toContain("i");
  });
});

// ---------------------------------------------------------------------------
// Output name constants
// ---------------------------------------------------------------------------
describe("Output name constants", () => {
  it("OUTPUT_ENV_FILE_PATH is a non-empty string", () => {
    expect(typeof OUTPUT_ENV_FILE_PATH).toBe("string");
    expect(OUTPUT_ENV_FILE_PATH).toBe("environment-file");
  });

  it("OUTPUT_ENV_FILE_CONTENT is a non-empty string", () => {
    expect(typeof OUTPUT_ENV_FILE_CONTENT).toBe("string");
    expect(OUTPUT_ENV_FILE_CONTENT).toBe("environment-file-content");
  });

  it("OUTPUT_ENV_FILE_WAS_PATCHED is a non-empty string", () => {
    expect(typeof OUTPUT_ENV_FILE_WAS_PATCHED).toBe("string");
    expect(OUTPUT_ENV_FILE_WAS_PATCHED).toBe("environment-file-was-patched");
  });
});

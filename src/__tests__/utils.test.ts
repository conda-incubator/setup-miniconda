import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock @actions/exec
vi.mock("@actions/exec", () => ({
  exec: vi.fn(),
}));

// Mock constants so tests are deterministic and decoupled from real values
vi.mock("../constants", () => ({
  DEFAULT_PKGS_DIR: "conda_pkgs_dir",
  BASE_ENV_NAMES: ["root", "base", ""],
  FORCED_ERRORS: ["EnvironmentSectionNotValid"],
  IGNORED_WARNINGS: ["menuinst_win32", "Unable to register environment", "0%|"],
}));

import * as os from "os";
import * as path from "path";
import * as exec from "@actions/exec";
import * as core from "@actions/core";

import { parsePkgsDirs, isBaseEnv, execute, makeSpec } from "../utils";

// ---------------------------------------------------------------------------
// parsePkgsDirs
// ---------------------------------------------------------------------------
describe("parsePkgsDirs", () => {
  it("returns default dir when given an empty string", () => {
    const result = parsePkgsDirs("");
    expect(result).toEqual([path.join(os.homedir(), "conda_pkgs_dir")]);
  });

  it("returns default dir when given only whitespace", () => {
    const result = parsePkgsDirs("   ");
    expect(result).toEqual([path.join(os.homedir(), "conda_pkgs_dir")]);
  });

  it("returns a single directory", () => {
    const result = parsePkgsDirs("/tmp/my_pkgs");
    expect(result).toEqual(["/tmp/my_pkgs"]);
  });

  it("splits comma-separated directories", () => {
    const result = parsePkgsDirs("/tmp/pkgs1,/tmp/pkgs2,/tmp/pkgs3");
    expect(result).toEqual(["/tmp/pkgs1", "/tmp/pkgs2", "/tmp/pkgs3"]);
  });

  it("trims whitespace around each directory", () => {
    const result = parsePkgsDirs("  /tmp/a , /tmp/b , /tmp/c  ");
    expect(result).toEqual(["/tmp/a", "/tmp/b", "/tmp/c"]);
  });

  it("filters out empty segments from extra commas", () => {
    const result = parsePkgsDirs(",/tmp/a,,/tmp/b,");
    expect(result).toEqual(["/tmp/a", "/tmp/b"]);
  });
});

// ---------------------------------------------------------------------------
// isBaseEnv
// ---------------------------------------------------------------------------
describe("isBaseEnv", () => {
  it('returns true for "base"', () => {
    expect(isBaseEnv("base")).toBe(true);
  });

  it('returns true for "root"', () => {
    expect(isBaseEnv("root")).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isBaseEnv("")).toBe(true);
  });

  it('returns false for "test"', () => {
    expect(isBaseEnv("test")).toBe(false);
  });

  it('returns false for "myenv"', () => {
    expect(isBaseEnv("myenv")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------
describe("execute", () => {
  const mockedExec = vi.mocked(exec.exec);
  const mockedWarning = vi.mocked(core.warning);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls exec.exec with the correct command and args", async () => {
    mockedExec.mockResolvedValue(0);

    await execute(["conda", "install", "numpy"]);

    expect(mockedExec).toHaveBeenCalledTimes(1);
    expect(mockedExec).toHaveBeenCalledWith(
      "conda",
      ["install", "numpy"],
      expect.any(Object),
    );
  });

  it("merges custom env with process.env", async () => {
    mockedExec.mockResolvedValue(0);

    await execute(["conda", "info"], { MY_VAR: "hello" });

    const options = mockedExec.mock.calls[0][2] as exec.ExecOptions;
    expect(options.env).toMatchObject({ MY_VAR: "hello" });
    // Verify process.env was actually merged (not just the custom vars)
    expect(Object.keys(options.env!).length).toBeGreaterThan(1);
  });

  it("returns void when captureOutput is false", async () => {
    mockedExec.mockResolvedValue(0);

    const result = await execute(["conda", "info"]);
    expect(result).toBeUndefined();
  });

  it("captures and returns stdout when captureOutput is true", async () => {
    mockedExec.mockImplementation(async (_cmd, _args, options) => {
      // Simulate stdout data through the listener
      const listeners = (options as exec.ExecOptions).listeners;
      if (listeners?.stdout) {
        listeners.stdout(Buffer.from("captured line 1\n"));
        listeners.stdout(Buffer.from("captured line 2\n"));
      }
      return 0;
    });

    const result = await execute(["conda", "info", "--json"], {}, true);
    expect(result).toBe("captured line 1\ncaptured line 2\n");
  });

  it("throws on non-zero exit code", async () => {
    mockedExec.mockResolvedValue(1);

    await expect(execute(["conda", "bad-command"])).rejects.toThrow(
      "conda return error code 1",
    );
  });

  it("throws when stdout contains a FORCED_ERROR", async () => {
    mockedExec.mockImplementation(async (_cmd, _args, options) => {
      const listeners = (options as exec.ExecOptions).listeners;
      if (listeners?.stdout) {
        listeners.stdout!(
          Buffer.from("Error: EnvironmentSectionNotValid found"),
        );
      }
      return 0;
    });

    await expect(execute(["conda", "env", "create"])).rejects.toThrow(
      /EnvironmentSectionNotValid/,
    );
  });

  it("calls core.warning for unrecognized stderr output", async () => {
    mockedExec.mockImplementation(async (_cmd, _args, options) => {
      const listeners = (options as exec.ExecOptions).listeners;
      if (listeners?.stderr) {
        listeners.stderr(Buffer.from("some unexpected warning"));
      }
      return 0;
    });

    await execute(["conda", "install", "numpy"]);

    expect(mockedWarning).toHaveBeenCalledWith("some unexpected warning");
  });

  it("suppresses stderr that matches IGNORED_WARNINGS", async () => {
    mockedExec.mockImplementation(async (_cmd, _args, options) => {
      const listeners = (options as exec.ExecOptions).listeners;
      if (listeners?.stderr) {
        listeners.stderr(Buffer.from("menuinst_win32 error blah"));
        listeners.stderr(Buffer.from("Unable to register environment xyz"));
        listeners.stderr(Buffer.from("0%| progress bar noise"));
      }
      return 0;
    });

    await execute(["conda", "install", "numpy"]);

    expect(mockedWarning).not.toHaveBeenCalled();
  });

  it("warns for non-ignored stderr but suppresses ignored ones in mixed output", async () => {
    mockedExec.mockImplementation(async (_cmd, _args, options) => {
      const listeners = (options as exec.ExecOptions).listeners;
      if (listeners?.stderr) {
        listeners.stderr(Buffer.from("menuinst_win32 noise"));
        listeners.stderr(Buffer.from("real warning here"));
      }
      return 0;
    });

    await execute(["conda", "install", "numpy"]);

    expect(mockedWarning).toHaveBeenCalledTimes(1);
    expect(mockedWarning).toHaveBeenCalledWith("real warning here");
  });
});

// ---------------------------------------------------------------------------
// makeSpec
// ---------------------------------------------------------------------------
describe("makeSpec", () => {
  it("uses = when version has no special characters", () => {
    expect(makeSpec("python", "3.11")).toBe("python=3.11");
  });

  it("concatenates directly when version starts with =", () => {
    expect(makeSpec("python", "=3.11")).toBe("python=3.11");
  });

  it("concatenates directly when version starts with >=", () => {
    expect(makeSpec("numpy", ">=1.24")).toBe("numpy>=1.24");
  });

  it("concatenates directly when version starts with <", () => {
    expect(makeSpec("numpy", "<2.0")).toBe("numpy<2.0");
  });

  it("concatenates directly when version contains !=", () => {
    expect(makeSpec("python", "!=2.7")).toBe("python!=2.7");
  });

  it("concatenates directly when version contains |", () => {
    expect(makeSpec("python", "|3.11")).toBe("python|3.11");
  });

  it("concatenates directly when version contains >", () => {
    expect(makeSpec("python", ">3.8")).toBe("python>3.8");
  });
});

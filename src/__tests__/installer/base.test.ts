import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInfo = vi.fn();
const mockWarning = vi.fn();
vi.mock("@actions/core", () => ({
  info: (...args: any[]) => mockInfo(...args),
  warning: (...args: any[]) => mockWarning(...args),
}));

const mockMv = vi.fn();
vi.mock("@actions/io", () => ({
  mv: (...args: any[]) => mockMv(...args),
}));

const mockFind = vi.fn();
const mockDownloadTool = vi.fn();
const mockCacheFile = vi.fn();
vi.mock("@actions/tool-cache", () => ({
  find: (...args: any[]) => mockFind(...args),
  downloadTool: (...args: any[]) => mockDownloadTool(...args),
  cacheFile: (...args: any[]) => mockCacheFile(...args),
}));

const streamState = vi.hoisted(() => ({ bytes: Buffer.from("") }));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const { Readable } = await import("node:stream");
  return {
    ...actual,
    createReadStream: () => Readable.from([streamState.bytes]),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ensureLocalInstaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw-download");
    mockCacheFile.mockResolvedValue("/tmp/cached-dir");
  });

  it("returns local path directly for file:// URLs", async () => {
    const { ensureLocalInstaller } = await import("../../installer/base");
    // Use platform-appropriate file URL
    const isWin = process.platform === "win32";
    const url = isWin
      ? "file:///C:/Users/runner/installer.sh"
      : "file:///home/user/installer.sh";
    const result = await ensureLocalInstaller({ url });
    // fileURLToPath returns platform-appropriate path
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result).toContain("installer.sh");
    // Should not attempt to download or cache
    expect(mockDownloadTool).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns local path for file:// URLs on Windows-style paths", async () => {
    const { ensureLocalInstaller } = await import("../../installer/base");
    const result = await ensureLocalInstaller({
      url: "file:///C:/Users/runner/installer.exe",
    });
    // fileURLToPath will convert this to a platform-appropriate path
    expect(result).toBeTruthy();
    expect(mockDownloadTool).not.toHaveBeenCalled();
  });

  it("returns cached path when tc.find hits", async () => {
    mockFind.mockReturnValue("/tmp/cache-dir");
    const { ensureLocalInstaller } = await import("../../installer/base");
    const result = await ensureLocalInstaller({
      url: "https://example.com/Miniconda3-latest-Linux-x86_64.sh",
    });
    // Use path.join for cross-platform compatibility (Windows uses backslashes)
    const path = await import("path");
    expect(result).toBe(
      path.join("/tmp/cache-dir", "Miniconda3-latest-Linux-x86_64.sh"),
    );
    expect(mockDownloadTool).not.toHaveBeenCalled();
  });

  it("looks up the cache by tool name (the cache key), not the filename (#536)", async () => {
    mockFind.mockReturnValue("/tmp/cache-dir");
    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
      tool: "Miniconda3",
      version: "1.2.3",
    });
    // Must look up by `tool` (matching tc.cacheFile), not the installer filename.
    expect(mockFind).toHaveBeenCalledWith("Miniconda3", "1.2.3");
    expect(mockDownloadTool).not.toHaveBeenCalled();
  });

  it("includes installer-sha256 in the cache version so a changed checksum re-downloads (#536)", async () => {
    const crypto = await import("crypto");
    const bytes = Buffer.from("x");
    streamState.bytes = bytes;
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    mockFind.mockReturnValue(""); // cache miss

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
      sha256,
    });

    // The cache key (version) must incorporate the sha, so updating
    // installer-sha256 misses a stale URL-only cache entry and re-downloads.
    expect(mockFind).toHaveBeenCalledWith(
      "installer.sh",
      expect.stringContaining(`sha256.${sha256}`),
    );
  });

  it("downloads, renames, and caches when cache misses", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw-download");
    mockCacheFile.mockResolvedValue("/tmp/cached-result");

    const { ensureLocalInstaller } = await import("../../installer/base");
    const result = await ensureLocalInstaller({
      url: "https://example.com/Miniconda3-latest-Linux-x86_64.sh",
    });

    // Should download
    expect(mockDownloadTool).toHaveBeenCalledWith(
      "https://example.com/Miniconda3-latest-Linux-x86_64.sh",
    );
    // Should rename with correct extension
    expect(mockMv).toHaveBeenCalledWith(
      "/tmp/raw-download",
      "/tmp/raw-download.sh",
    );
    // Should cache the file
    expect(mockCacheFile).toHaveBeenCalledWith(
      "/tmp/raw-download.sh",
      "Miniconda3-latest-Linux-x86_64.sh",
      "Miniconda3-latest-Linux-x86_64.sh",
      expect.any(String),
    );
    // The result is the renamed path
    expect(result).toBe("/tmp/raw-download.sh");
  });

  it("verifies a matching installer sha256 (#518)", async () => {
    const crypto = await import("crypto");
    const bytes = Buffer.from("installer-contents");
    streamState.bytes = bytes;
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

    const { ensureLocalInstaller } = await import("../../installer/base");
    const result = await ensureLocalInstaller({
      url: "https://example.com/Installer.sh",
      sha256,
    });
    expect(result).toBe("/tmp/raw-download.sh");
  });

  it("throws on a mismatched installer sha256 (#518)", async () => {
    streamState.bytes = Buffer.from("installer-contents");
    const { ensureLocalInstaller } = await import("../../installer/base");
    await expect(
      ensureLocalInstaller({
        url: "https://example.com/Installer.sh",
        sha256: "0".repeat(64),
      }),
    ).rejects.toThrow(/checksum mismatch/i);
  });

  it("warns when the installer URL uses insecure http (#518)", async () => {
    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({ url: "http://example.com/Installer.sh" });
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("insecure 'http:'"),
    );
  });

  it("uses provided tool and version for caching", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
      tool: "MyTool",
      version: "1.2.3",
    });

    expect(mockCacheFile).toHaveBeenCalledWith(
      "/tmp/raw.sh",
      "installer.sh",
      "MyTool",
      "1.2.3",
    );
  });

  it("generates a sha256-based version when version is not provided", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
    });

    // The version should be 0.0.0-<sha256hex>
    const versionArg = mockCacheFile.mock.calls[0][3] as string;
    expect(versionArg).toMatch(/^0\.0\.0-[a-f0-9]{64}$/);
  });

  it("passes arch to tc.find and tc.cacheFile when provided", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
      tool: "MyTool",
      version: "1.0.0",
      arch: "x86_64",
    });

    // tc.find is called with the tool name (cache key) and arch spread arg
    expect(mockFind).toHaveBeenCalledWith("MyTool", "1.0.0", "x86_64");
    // tc.cacheFile is called with arch as the extra spread arg
    expect(mockCacheFile).toHaveBeenCalledWith(
      "/tmp/raw.sh",
      "installer.sh",
      "MyTool",
      "1.0.0",
      "x86_64",
    );
  });

  it("does not pass arch to tc.find when arch is not provided", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh",
      tool: "MyTool",
      version: "1.0.0",
    });

    // tc.find called with the tool name (cache key), without arch
    expect(mockFind).toHaveBeenCalledWith("MyTool", "1.0.0");
  });

  it("handles .exe extension correctly", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    const result = await ensureLocalInstaller({
      url: "https://example.com/Miniconda3-latest-Windows-x86_64.exe",
    });

    expect(mockMv).toHaveBeenCalledWith("/tmp/raw", "/tmp/raw.exe");
    expect(result).toBe("/tmp/raw.exe");
  });

  it("handles URLs with query params - basename is extracted from pathname", async () => {
    mockFind.mockReturnValue("");
    mockDownloadTool.mockResolvedValue("/tmp/raw");
    mockCacheFile.mockResolvedValue("/tmp/cached");

    const { ensureLocalInstaller } = await import("../../installer/base");
    await ensureLocalInstaller({
      url: "https://example.com/installer.sh?token=abc123#anchor",
    });

    // The installer name should be extracted from the pathname, ignoring query/hash
    expect(mockCacheFile).toHaveBeenCalledWith(
      expect.any(String),
      "installer.sh",
      expect.any(String),
      expect.any(String),
    );
  });
});

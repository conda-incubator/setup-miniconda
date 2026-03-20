import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { retryWithBackoff } from "../retry";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("CondaHTTPError: HTTP 000 CONNECTION FAILED"),
      )
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses exponential backoff between retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 1"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 2"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 3"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 5,
      initialDelayMs: 1000,
      backoffFactor: 2,
    });

    // Attempt 1 fails immediately, wait 1000ms (1000 * 2^0)
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);

    // Attempt 2 fails, wait 2000ms (1000 * 2^1)
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);

    // Attempt 3 fails, wait 4000ms (1000 * 2^2)
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);

    // Attempt 4 succeeds
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("exhausts all retries and throws the last error", async () => {
    vi.useRealTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("CondaHTTPError: HTTP 503"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: HTTP 503"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: HTTP 503"));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
        backoffFactor: 2,
      }),
    ).rejects.toThrow("CondaHTTPError: HTTP 503");

    // 1 initial + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);

    vi.useFakeTimers();
  });

  it("does not retry on non-retryable errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("PackagesNotFoundError: numpy=99.99"));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 1000 }),
    ).rejects.toThrow("PackagesNotFoundError");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on ResolvePackageNotFound", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ResolvePackageNotFound: pandas"));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 1000 }),
    ).rejects.toThrow("ResolvePackageNotFound");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on ConnectionError", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("requests.exceptions.ConnectionError: connection refused"),
      )
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on SSLError", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("SSLError: [SSL: CERTIFICATE_VERIFY_FAILED]"),
      )
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 5xx status codes", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 502 Bad Gateway"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("caps delay at maxDelayMs", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 1"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 2"))
      .mockRejectedValueOnce(new Error("CondaHTTPError: attempt 3"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 5,
      initialDelayMs: 5000,
      backoffFactor: 2,
      maxDelayMs: 8000,
    });

    // Attempt 1 fails, wait 5000ms (5000 * 2^0)
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Attempt 2 fails, wait 8000ms (capped from 10000 = 5000 * 2^1)
    await vi.advanceTimersByTimeAsync(8000);
    expect(fn).toHaveBeenCalledTimes(3);

    // Attempt 3 fails, wait 8000ms (capped from 20000 = 5000 * 2^2)
    await vi.advanceTimersByTimeAsync(8000);
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("accepts custom retryable check function", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("custom transient error"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
      isRetryable: (err) => err.message.includes("custom transient"),
    });

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("defaults to 0 retries when maxRetries not specified", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("CondaHTTPError: HTTP 503"));

    await expect(retryWithBackoff(fn)).rejects.toThrow("CondaHTTPError");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

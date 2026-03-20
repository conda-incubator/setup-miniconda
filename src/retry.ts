import * as core from "@actions/core";

import * as constants from "./constants";

/**
 * Options for retry with exponential backoff
 */
export interface IRetryOptions {
  /** Maximum number of retries after the initial attempt (default: 0) */
  maxRetries?: number;
  /** Initial delay in milliseconds before the first retry (default: 10000) */
  initialDelayMs?: number;
  /** Multiplier applied to the delay after each retry (default: 2) */
  backoffFactor?: number;
  /** Maximum delay in milliseconds between retries (default: 60000) */
  maxDelayMs?: number;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Whether an error message matches known transient/retryable patterns
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message || "";
  return constants.RETRYABLE_ERROR_PATTERNS.some((pattern) =>
    message.match(pattern),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry logic.
 *
 * Only retries on errors deemed transient (HTTP errors, connection failures,
 * SSL errors). Non-retryable errors (e.g. PackagesNotFoundError) are thrown
 * immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: IRetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 0,
    initialDelayMs = 10_000,
    backoffFactor = 2,
    maxDelayMs = 60_000,
    isRetryable: isRetryableFn = isRetryableError,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isRetryableFn(lastError)) {
        throw lastError;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt),
        maxDelayMs,
      );
      core.warning(
        `Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`,
      );
      core.info(`Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

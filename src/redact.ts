/**
 * @module redact
 * Helpers for masking anaconda.org channel tokens so they never leak into
 * build logs or action outputs.
 *
 * Channel URLs may carry a token, e.g.
 * `https://conda.anaconda.org/t/<token>/<channel>`. These helpers live in a
 * dedicated module used only by the setup-side code, so they are not bundled
 * into the post/delete action where they would be unused.
 *
 * @category Utilities
 */

/**
 * Find anaconda.org channel tokens embedded in a string.
 *
 * The returned raw tokens should be registered with `core.setSecret` before
 * anything is logged so the runner masks them everywhere.
 *
 * @param text - Arbitrary text that may contain `/t/<token>/` channel URLs.
 * @returns The token values found (may contain duplicates).
 */
export function findTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(/\/t\/([^/\s'"]+)/g)) {
    const token = match[1];
    if (token) {
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Redact anaconda.org channel tokens so a string is safe to log.
 *
 * Replaces the `<token>` in `/t/<token>/` with `***`, leaving the rest of the
 * URL intact. The value written to disk should keep the real token; only
 * logged output should be redacted.
 *
 * @param text - Arbitrary text that may contain `/t/<token>/` channel URLs.
 * @returns The text with any channel tokens replaced by `***`.
 */
export function redactTokens(text: string): string {
  return text.replace(/(\/t\/)[^/\s'"]+/g, "$1***");
}

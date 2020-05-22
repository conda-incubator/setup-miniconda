import * as core from "@actions/core";

// General use
//-----------------------------------------------------------------------
/**
 * Pretty print section messages
 *
 * @param args
 */
function consoleLog(...args: string[]): void {
  for (let arg of args) {
    core.info("\n# " + arg);
    core.info("#".repeat(arg.length + 2) + "\n");
  }
}

export { consoleLog };

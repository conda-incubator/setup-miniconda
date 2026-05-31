/**
 * @module __tests__/helpers
 * Shared test fixtures for building action inputs.
 *
 * Centralizes the default `IActionInputs` / `ICondaConfig` shape so that adding
 * a new action input or condarc key only requires editing this one file,
 * instead of every test module that builds inputs.
 */

import type * as types from "../types";

/**
 * Overrides accepted by {@link makeActionInputs}: any top-level input field,
 * plus a *partial* `condaConfig` that is shallow-merged onto the defaults.
 */
export type ActionInputsOverrides = Partial<
  Omit<types.IActionInputs, "condaConfig">
> & {
  condaConfig?: Partial<types.ICondaConfig>;
};

/**
 * Build a default `ICondaConfig`, optionally overriding individual keys.
 *
 * @param overrides - Condarc keys to override on top of the defaults.
 * @returns A complete `ICondaConfig`.
 */
export function makeCondaConfig(
  overrides: Partial<types.ICondaConfig> = {},
): types.ICondaConfig {
  return Object.freeze({
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
    use_sharded_repodata: "",
    always_yes: "true",
    changeps1: "false",
    solver: "",
    pkgs_dirs: "",
    ...overrides,
  });
}

/**
 * Build a complete `IActionInputs` for tests with sensible defaults.
 *
 * Top-level fields can be overridden directly; `condaConfig` is shallow-merged
 * onto the defaults via {@link makeCondaConfig}.
 *
 * @param overrides - Input fields to override on top of the defaults.
 * @returns A complete `IActionInputs`.
 */
export function makeActionInputs(
  overrides: ActionInputsOverrides = {},
): types.IActionInputs {
  const { condaConfig: condaConfigOverrides, ...rest } = overrides;
  return Object.freeze({
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
    ...rest,
    condaConfig: makeCondaConfig(condaConfigOverrides),
  });
}

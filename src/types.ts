//-----------------------------------------------------------------------
// Types & Interfaces
//-----------------------------------------------------------------------

export interface IArchitectures {
  [key: string]: string;
}

export interface IOperatingSystems {
  [key: string]: string;
}

export interface IShells {
  [key: string]: string;
}

export type TCondaConfig = any;
export type TEnvironment = any;

/**
 * Metadata needed to attempt retrieving an installer from, or to update, the tool cache
 */
export interface ILocalInstallerOpts {
  url: string;
  tool?: string;
  version?: string;
  arch?: string;
}

/**
 * Special case `dependencies` member for pip  in `environment.yml`
 */
export interface IPipSpec {
  pip: string[];
}

/**
 * Any valid member of `dependencies` in `environment.yml`.
 */
export type TYamlDependencies = (string | IPipSpec)[];

/**
 * A (partial) `environment.yml`
 */
export interface IEnvironment {
  name?: string;
  channels?: string[];
  dependencies?: TYamlDependencies;
}

/**
 * A subset of the .condarc file options available as action inputs
 * https://docs.conda.io/projects/conda/en/latest/user-guide/configuration/use-condarc.html
 */
export interface ICondaConfig {
  add_anaconda_token: string;
  add_pip_as_python_dependency: string;
  allow_softlinks: string;
  auto_activate_base: string;
  auto_update_conda: string;
  channel_alias: string;
  channel_priority: string;
  channels: string;
  show_channel_urls: string;
  use_only_tar_bz2: string;
  always_yes: string;
  changeps1: string;
}

/**
 * The action inputs, as defined in `action.yml`
 */
export interface IActionInputs {
  readonly activateEnvironment: string;
  readonly architecture: string;
  readonly condaBuildVersion: string;
  readonly condaConfig: Readonly<ICondaConfig>;
  readonly condaConfigFile: string;
  readonly condaVersion: string;
  readonly environmentFile: string;
  readonly installerUrl: string;
  readonly mambaVersion: string;
  readonly minicondaVersion: string;
  readonly pythonVersion: string;
  readonly removeProfiles: string;
}

/**
 * Options that may change during the course of discovery/installation/configuration
 */
export interface IDynamicOptions {
  useBundled: boolean;
  useMamba: boolean;
  envSpec?: IEnvSpec;
  condaConfig: TCondaConfig;
}

/**
 * File contents describing an environment
 */
export interface IEnvSpec {
  yaml?: IEnvironment;
  explicit?: string;
}

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
  readonly miniforgeVariant: string;
  readonly miniforgeVersion: string;
  readonly pythonVersion: string;
  readonly removeProfiles: string;
  readonly useMamba: string;
}

/**
 * Options that may change during the course of discovery/installation/configuration
 */
export interface IDynamicOptions {
  useBundled: boolean;
  useMamba: boolean;
  mambaInInstaller: boolean;
  envSpec?: IEnvSpec;
  condaConfig: TCondaConfig;
}

/**
 * File contents describing an environment
 */
export interface IEnvSpec {
  /** A `conda env`-compatible YAML env description */
  yaml?: IEnvironment;
  /** A `conda list --explicit`-compatible text env description */
  explicit?: string;
}

/**
 * The output of an installer: may update the dynamic options
 */
export interface IInstallerResult {
  /** Options that may change as a result of selecting the installer */
  options: IDynamicOptions;
  /** The local path to the installer. May be empty if the bundled installer is used */
  localInstallerPath: string;
}

/**
 * A strategy for ensuring a locally-runnable provider (or no-op, if bundled)
 */
export interface IInstallerProvider {
  /** A human-readable name shown in logs */
  label: string;
  /** Whether this set of actions and inputs entails using this provider */
  provides: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<boolean>;
  /** Provide the local file path (and any updated options) for the installer */
  installerPath: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<IInstallerResult>;
}

/**
 * A strategy for ensuring a test environment that matches the action inputs
 */
export interface IEnvProvider {
  label: string;
  /**
   * Whether this provider is requested by action inputs
   */
  provides: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<boolean>;
  /**
   * The args to conda/mamba, e.g. create, update
   */
  condaArgs: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<string[]>;
}

/** The options and package specs to add to the base environment */
export interface IToolUpdates {
  options: IDynamicOptions;
  tools: string[];
}

/**
 * A strategy for ensuring a tool is available in the conda 'base'
 */
export interface IToolProvider {
  label: string;
  /**
   * Whether this provider is requested by action inputs
   */
  provides: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<boolean>;
  /**
   * Conda package specs and option updates for tools to install after updating
   */
  toolPackages: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<IToolUpdates>;
  /**
   * Steps to perform after the env is updated, and potentially reconfigured
   */
  postInstall?: (
    inputs: IActionInputs,
    options: IDynamicOptions
  ) => Promise<void>;
}

/** A release asset from the GitHub API */
export interface IGithubAsset {
  browser_download_url: string;
  created_at: string;
  name: string;
}

/** An asset with some extra metadata from the release */
export interface IGithubAssetWithRelease extends IGithubAsset {
  tag_name: string;
}

/** The body of the API request */
export interface IGithubRelease {
  assets: IGithubAsset[];
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
}

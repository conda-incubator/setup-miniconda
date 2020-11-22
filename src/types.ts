//-----------------------------------------------------------------------
// Types & Interfaces
//-----------------------------------------------------------------------
export interface ISucceedResult {
  ok: true;
  data: string;
}
export interface IFailedResult {
  ok: false;
  error: Error;
}
export type Result = ISucceedResult | IFailedResult;

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

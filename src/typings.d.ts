declare module "get-hrefs" {
  import normalizeUrl from "normalize-url";
  /** Map of URL protocols to whether they are allowed for href extraction */
  export interface IAllowedProtocols {
    [key: string]: boolean;
  }
  /** Options for the get-hrefs HTML link extractor */
  export interface IOptions extends normalizeUrl.Options {
    baseUrl?: string;
    allowedProtocols?: IAllowedProtocols;
  }
  export default function getHrefs(html: string, options?: IOptions): string[];
}

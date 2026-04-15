declare module "get-hrefs" {
  /** Map of URL protocols to whether they are allowed for href extraction. */
  export interface IAllowedProtocols {
    [key: string]: boolean;
  }
  /** Options for the get-hrefs HTML link extractor. */
  export interface IOptions {
    baseUrl?: string;
    allowedProtocols?: IAllowedProtocols;
  }
  export default function getHrefs(html: string, options?: IOptions): string[];
}

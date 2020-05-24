declare module "get-hrefs" {
  import normalizeUrl from "normalize-url";
  export interface IAllowedProtocols {
    [key: string]: boolean;
  }
  export interface IOptions extends normalizeUrl.Options {
    baseUrl?: string;
    allowedProtocols?: IAllowedProtocols;
  }
  export default function getHrefs(html: string, options?: IOptions): string[];
}

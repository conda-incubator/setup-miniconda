declare module "get-hrefs" {
  import type { Options as NormalizeUrlOptions } from "normalize-url";
  export interface IAllowedProtocols {
    [key: string]: boolean;
  }
  export interface IOptions extends NormalizeUrlOptions {
    baseUrl?: string;
    allowedProtocols?: IAllowedProtocols;
  }
  export default function getHrefs(html: string, options?: IOptions): string[];
}

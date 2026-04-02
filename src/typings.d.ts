declare module "get-hrefs" {
  export interface IAllowedProtocols {
    [key: string]: boolean;
  }
  export interface IOptions {
    baseUrl?: string;
    allowedProtocols?: IAllowedProtocols;
  }
  export default function getHrefs(html: string, options?: IOptions): string[];
}

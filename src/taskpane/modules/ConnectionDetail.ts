import * as diffusion from "diffusion";

/**
 * An encapsulation of the location and credentials required to connect to a Diffusion server.
 */
export class ConnectionDetail {
  constructor(readonly url: URL, readonly principal: string, readonly credentials?: string) {}

  /**
   * Build a diffusion.Options.
   * @returns {diffusion.Options} the argument suitable for passing to `diffusion.connect`.
   */
  public toOptions(): diffusion.Options {
    const isSecure = (url: URL) => url.protocol === "wss:" || url.protocol === "https:";
    const getPort = (url: URL) => (url.port != "" ? parseInt(url.port) : isSecure(url) ? 443 : 80);
    const result: diffusion.Options = {
      host: this.url.host,
      secure: isSecure(this.url),
      port: getPort(this.url),
      principal: this.principal,
    };

    if (this.credentials !== undefined) {
      result.credentials = this.credentials;
    }

    return result;
  }

  /**
   * @returns {string} a string suitable for display.
   */
  public toString(): string {
    const url = new URL(this.url);
    if (this.principal) {
      url.username = this.principal;
    }
    return url.toString();
  }
}

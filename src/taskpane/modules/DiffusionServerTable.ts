/**
 * The DiffusionServerTable and associated types.
 */
import { GUID, KeyedObject } from "./Common";
import { ConnectionDetail } from "./ConnectionDetail";

import * as diffusion from "diffusion";

/**
 * The table row definition.
 * The relation between a Diffusion server, its URL, and associated session and session status.
 */
export type DiffusionServerRow = KeyedObject & {
  /**
   * Details required to connect a Sessions.
   */
  serverLocation: ConnectionDetail;

  /**
   * Optional Diffusion session.
   */
  session: diffusion.Session | null;
};

/**
 * A table of DiffusionServerRow.
 */
export class DiffusionServerTable extends Map<GUID, DiffusionServerRow> {
  constructor(kvPairs: [GUID, DiffusionServerRow][]) {
    super(kvPairs);
  }

  clone(): DiffusionServerTable {
    return new DiffusionServerTable([...this.entries()]);
  }

  /**
   * @returns {boolean} true if at least one server is connected
   */
  hasSession(): boolean {
    return [...this.values()].some((row) => row.session?.isConnected());
  }

  /**
   * @returns {DiffusionServerRow[]} - the list of all connected servers
   */
  connectedServers(): DiffusionServerRow[] {
    return [...this.values()].filter((row) => (row.session ? true : false));
  }

  /**
   * Convenience factory method. Build a table from a list of rows.
   * NB: does not detect key collisions!
   * @param {DiffusionServerRow[]} rows - the list of rows
   * @returns {DiffusionServerTable} - the newly constructed table
   */
  static from(rows: DiffusionServerRow[]): DiffusionServerTable {
    const kvPairs: [GUID, DiffusionServerRow][] = rows.map((t) => [t.key, t]);
    return new DiffusionServerTable(kvPairs);
  }

  /**
   * @returns {DiffusionServerRow} - the first row in the table
   */
  getFirst(): DiffusionServerRow {
    return this.values().next().value;
  }
}

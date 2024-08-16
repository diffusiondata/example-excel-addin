/**
 * Inspired in name by the JFace TableViewer.
 */
import { Primitive, rangeFrom } from "./Common";
import mitt, { Emitter } from "mitt";
import { RangeExpression } from "./RangeExpression";

/**
 * The schema of a table. The set of columns.
 */
export class TableSchema {
  readonly keyFieldOffset: number;

  constructor(readonly fields: string[], readonly keyFieldName: string) {
    this.keyFieldOffset = fields.findIndex((f) => f === keyFieldName);
    if (this.keyFieldOffset < 0) {
      throw new Error(`Schema violation. Key field ${keyFieldName} absent from schema`);
    }
  }
}

/**
 * Interface of methods required to retrieve values from a model element.
 */
export interface TableContentProvider<T> {
  getField(input: T, fieldName: string): Primitive;
}

/**
 * Events emitted by the TableViewer.
 */
export type TableViewerEvents = {
  /**
   * Emitted when a table is deleted.
   */
  deleted: {
    tableID: string;
    tableName: string;
  };
};

/**
 * Error thrown by the TableViewer.
 */
export class TableViewerError extends Error {
  public tableID: string;
  public tableSchema: TableSchema;

  constructor(message: string, tableID: string, tableSchema: TableSchema) {
    super(message);
    this.tableID = tableID;
    this.tableSchema = tableSchema;
    Object.setPrototypeOf(this, TableViewerError.prototype);
  }
}

/**
 * The TableViewer class encapsulates an Excel.Table object and layers atop functionality so
 * developers can interact with the table in terms of topic updates, instead of rows and columns. Row
 * locations are indexed optimistically and rebuilt when the table is reordered.
 */
export class TableViewer<T> {
  /**
   * Builder function.
   * @template T The type of the content rows.
   * @param {string} tableAddress The address of the table, e.g. `A1`
   * @param {TableSchema} tableSchema The schema of the table, used to decide the rows
   * @param {TableContentProvider<T>} contentProvider The content provider for the table.
   * @returns {Promise<TableViewer<T>>} A promise that resolves to a TableViewer instance.
   */
  public static async build<T>(
    tableAddress: string,
    tableSchema: TableSchema,
    contentProvider: TableContentProvider<T>
  ): Promise<TableViewer<T>> {
    const events = mitt<TableViewerEvents>();

    // Create the actual table
    const tableID = await Excel.run(async (context) => {
      // Map the tableAddress to range
      const tableRange = RangeExpression.parse(tableAddress)
        .getRange(context)
        .getAbsoluteResizedRange(1, tableSchema.fields.length);
      tableRange.load("address");
      await context.sync();
      console.debug(`Creating table with address: ${tableRange.address}`);

      const table = context.workbook.tables.add(tableRange, true);
      table.getHeaderRowRange().values = [tableSchema.fields];
      table.highlightFirstColumn = tableSchema.keyFieldOffset === 0;

      context.workbook.tables.onDeleted.add(async (ev) => {
        if (ev.tableId === table.id) {
          events.emit("deleted", { tableID: ev.tableId, tableName: ev.tableName });
        }
      });

      await context.sync();
      return table.id;
    });

    return new TableViewer(tableID, tableSchema, contentProvider, events);
  }

  // a map of key values to table offsets
  private index = new Map<Primitive, number>();

  private constructor(
    readonly tableID: string,
    private schema: TableSchema,
    private contentProvider: TableContentProvider<T>,
    readonly events: Emitter<TableViewerEvents>
  ) {}

  /**
   * @param key key to check for.
   * @returns {boolean} true if the key is present in the table.
   */
  public has(key: Primitive): boolean {
    return this.index.has(key);
  }

  /**
   * Add rows to the table.
   * @template T The type of the model elements.
   * @param {T[]} input rows to add.
   * @returns {Promise<void>} a promise that resolves when the rows are added.
   */
  public async addRows(input: T[]): Promise<void> {
    if (input.length == 0) {
      return;
    }

    const keysToRows = new Map<Primitive, Primitive[]>(input.map((item) => [this.getKey(item), this.toRowData(item)]));

    await Excel.run(async (context) => {
      const table = await this.getTable(context);

      try {
        const dataRows = [...keysToRows.values()];
        const newRowIndices = await this.simpleAdd(table, dataRows, context);

        // Update the index
        [...keysToRows.keys()].map((key, i) => {
          this.index.set(key, newRowIndices[i]);
        });
      } catch (ex: any) {
        if (isStructuralMutation(ex)) {
          throw new TableViewerError(`Table does not match its schema`, this.tableID, this.schema);
        } else {
          throw ex;
        }
      }
    });
  }

  /**
   * Remove rows from the table.
   * @param {Primitive[]} keyValues keys of the rows to remove.
   * @returns {Promise<void>} a promise that resolves when the rows are removed.
   */
  public async removeRows(keyValues: Primitive[]): Promise<void> {
    if (keyValues.length == 0) {
      return;
    }
    await Excel.run(async (context) => {
      const table = await this.getTable(context);
      const keysToRows = await this.getMatchingRows(keyValues, table, context);
      table.rows.deleteRows([...keysToRows.values()]);

      return context.sync();
    });
  }

  /**
   * Update existing rows in the table.
   * @template T The type of the model elements.
   * @param {T[]} input rows to add.
   * @returns {Promise<void>} a promise that resolves when the rows are updated.
   */
  public async updateRows(input: T[]): Promise<void> {
    if (input.length == 0) {
      return;
    }
    // Assemble a map of key -> item
    const newRowsByKey = input.reduce((acc, item) => {
      acc.set(this.getKey(item), item);
      return acc;
    }, new Map<Primitive, T>());

    // Get the tableRow
    await Excel.run(async (context) => {
      const table = await this.getTable(context);
      const keysToRows = await this.getMatchingRows([...newRowsByKey.keys()], table, context);

      keysToRows.forEach((tableRow, key) => {
        tableRow.values = [this.toRowData(newRowsByKey.get(key)!)];
      });

      // Update the tableRow
      try {
        return context.sync();
      } catch (ex: any) {
        if (isStructuralMutation(ex)) {
          throw new TableViewerError(`Table does not match its schema`, this.tableID, this.schema);
        } else {
          throw ex;
        }
      }
    });
  }

  private async getTable(context: Excel.RequestContext): Promise<Excel.Table> {
    const result = context.workbook.tables.getItemOrNullObject(this.tableID);
    await context.sync();
    if (result.isNullObject) {
      throw new TableViewerError("Table is absent", this.tableID, this.schema);
    }

    return result;
  }

  private getKey(input: T): Primitive {
    return this.contentProvider.getField(input, this.schema.keyFieldName);
  }

  private toRowData(input: T): Primitive[] {
    return this.schema.fields.reduce((acc, fieldName) => {
      acc.push(this.contentProvider.getField(input, fieldName));
      return acc;
    }, new Array<Primitive>());
  }

  private async getMatchingRows(
    keyValues: Primitive[],
    table: Excel.Table,
    context: Excel.RequestContext
  ): Promise<Map<Primitive, Excel.TableRow>> {
    // Loop once if the index is valid, and twice if it's not
    for (let i = 0; i < 2; i++) {
      try {
        // Resolve the keyValues to a map of <Key, TableRow> and load their values
        const tableRows = keyValues.reduce((acc, keyValue) => {
          const rowNumber = this.index.get(keyValue);
          if (rowNumber === undefined) {
            throw new Error(`Unknown input data with key ${keyValue}`);
          }

          const tableRow = table.rows.getItemAt(rowNumber);
          tableRow.load("values");
          acc.set(keyValue, tableRow);
          return acc;
        }, new Map<Primitive, Excel.TableRow>());

        // eslint-disable-next-line office-addins/no-context-sync-in-loop
        await context.sync();

        // Validate all keys match and return the tableRows match
        if (
          [...tableRows.entries()].every(([key, tableRow]) => key === tableRow.values[0][this.schema.keyFieldOffset])
        ) {
          return tableRows;
        }
      } catch (ex: any) {
        if (ex.code !== "InvalidArgument") {
          // requested a row outside the current table dimensions.
          throw ex;
        }
      }

      // rebuild the index
      console.debug(`Rebuilding index of ${this.index.size} items`);
      this.index = await this.buildIndex(context, table);
    }
    throw new Error(`Index violation, expected key value '${keyValues}' following index rebuild.`);
  }

  private async buildIndex(context: Excel.RequestContext, table: Excel.Table): Promise<Map<Primitive, number>> {
    // Reach into the table, grab only the key column
    const keyColumn = table.getDataBodyRange().getColumn(this.schema.keyFieldOffset);
    keyColumn.load("values");
    await context.sync();

    // Build an index from it
    const result = new Map<Primitive, number>();
    keyColumn.values.forEach((row, i) => {
      result.set(row[0], i);
    });
    return result;
  }

  private async simpleAdd(table: Excel.Table, rows: Primitive[][], context: Excel.RequestContext): Promise<number[]> {
    const topTableRow = table.rows.add(-1, rows);
    topTableRow.load("index");

    await context.sync();
    return rangeFrom(topTableRow.index, topTableRow.index + rows.length - 1);
  }
}

const RE = /the input array doesn’t match the size /;
const isStructuralMutation = (ex: any) => RE.test(ex.message);

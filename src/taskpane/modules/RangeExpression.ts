/**
 * Encapsulation of a range express such as `A1` and `B7:C5` and `Sheet4!Q4:Z10`.
 */
export class RangeExpression {
  /**
   * Map an address like `Sheet2!A1:B9` to a Range address - regardless of the active worksheet.
   * @param {Excel.RequestContext} context The request context.
   * @returns {Excel.Range} the mapped address.
   */
  getRange(context: Excel.RequestContext): Excel.Range {
    const worksheet = this.sheetName
      ? context.workbook.worksheets.getItem(this.sheetName)
      : context.workbook.worksheets.getActiveWorksheet();

    const addressStr = this.end ? `${this.start}:${this.end}` : this.start;
    return worksheet.getRange(addressStr);
  }

  private constructor(readonly sheetName: string | undefined, readonly start: string, readonly end?: string) {
    /* do nothing more */
  }

  /**
   * Factory function. Parse a range expression into a RangeExpression object.
   * @param {string} rangeExpression a range expression like `Sheet2!A1:B9`.
   * @returns {RangeExpression} the parsed range expression.
   */
  public static parse(rangeExpression: string): RangeExpression {
    const regex = /^((.*?)!)?([A-Z]+[0-9]+)(?::([A-Z]+[0-9]+))?$/;

    const match = rangeExpression.match(regex);
    if (match) {
      const [sheetName, start, end] = [match[2], match[3], match[4]];
      if (start) {
        return new RangeExpression(sheetName, start, end);
      }
    }

    throw new Error("Cannot parse: " + rangeExpression);
  }
}

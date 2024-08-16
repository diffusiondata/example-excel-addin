import * as React from "react";
import { SymbolTopicRow } from "../modules/Common";
import { makeStyles } from "@fluentui/react-components";
import { capitaliseFirstLetter } from "../modules/Common";

// @ts-ignore - country-currency-emoji-flags lacks types
import { getEmojiByCurrencyCode } from "country-currency-emoji-flags";

type CurrencyPairPersonaProps = {
  row: SymbolTopicRow;
  query?: string;
};

const useStyles = makeStyles({
  currencyPairPersona: {},

  currencyPairPersonaHeader: {
    fontWeight: "bold",
    fontSize: "larger",
  },

  currencyPairPersonaProvider: {
    fontSize: "smaller",
    fontStyle: "italic",
  },

  currencyPairPersonaFlags: {
    fontSize: "larger",
  },

  queryMatch: {
    textDecoration: "underline",
  },
});

/**
 * Displays a currency pair and the relevant national flags where possible.
 * @param {CurrencyPairPersonaProps} props - The properties object.
 * @param {SymbolTopicRow} props.row - The currency pair data.
 * @param {string} props.query - The search query.
 * @returns {React.ReactElement} The rendered CurrencyPairPersona component.
 */
export function CurrencyPairPersona({ row, query }: CurrencyPairPersonaProps): React.ReactElement {
  const styles = useStyles();

  const highlight = (symbol: string) => {
    if (!query) {
      return <span>{symbol}</span>;
    }

    const parts = symbol.split(new RegExp(`(${query})`, "gi"));

    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={index} className={styles.queryMatch}>
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  const flagFrom = getEmojiByCurrencyCode(row.symbol.slice(0, 3));
  const flagTo = getEmojiByCurrencyCode(row.symbol.slice(3));
  return (
    <div className={styles.currencyPairPersona}>
      <div className={styles.currencyPairPersonaHeader}>{highlight(row.symbol)}</div>
      <div className={styles.currencyPairPersonaFlags}>
        {flagFrom} → {flagTo}
      </div>
      <div className={styles.currencyPairPersonaProvider}>{capitaliseFirstLetter(row.provider)}</div>
    </div>
  );
}

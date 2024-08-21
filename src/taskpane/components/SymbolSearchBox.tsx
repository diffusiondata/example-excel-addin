import { Combobox, Option, Label, ComboboxProps, makeStyles } from "@fluentui/react-components";
import * as React from "react";
import * as diffusion from "diffusion";
import { SymbolTopicTable } from "../modules/Common";
import { SymbolTopicRow } from "../modules/Common";
import { CurrencyPairPersona } from "./CurrencyPairPersona";

const useStyles = makeStyles({
  searchBox: {
    marginBottom: "15px",
    "& input": {
      textTransform: "uppercase",
    },
  },
});

export type SymbolSearchBoxProps = {
  session: diffusion.Session | null;
  selectedOptions: SymbolTopicRow[];
  setSelectedOptions: React.Dispatch<React.SetStateAction<SymbolTopicRow[]>>;
};

/**
 * Allows users to search and select symbols from a Diffusion server.
 * Symbols are sought using a topic selector and presented in a dropdown where the
 * user can interact with them further.
 * <br />
 * @param {SymbolSearchBoxProps} props - The properties object.
 * @param {diffusion.Session | null} props.session - The Diffusion session instance.
 * @param {SymbolTopicRow[]} props.selectedOptions - The currently selected symbol options.
 * @param {React.Dispatch<React.SetStateAction<SymbolTopicRow[]>>} props.setSelectedOptions - Function to update the selected symbol options.
 * @returns {React.ReactElement} The rendered SymbolSearchBox component.
 */
export function SymbolSearchBox({ session, selectedOptions, setSelectedOptions }: SymbolSearchBoxProps) {
  const [query, setQuery] = React.useState<string>("");
  const [symbolTopicTable, setSymbolTopicTable] = React.useState<SymbolTopicTable>([]);

  React.useEffect(() => {
    searchSymbols(".*").then((table) => setSymbolTopicTable(table));
  }, []);

  const styles = useStyles();

  const searchSymbols = async (symbolFragment: string): Promise<SymbolTopicTable> => {
    const fetchResult = await session!
      .fetchRequest()
      .topicTypes([diffusion.topics.TopicType.JSON])
      .fetch(`?market-data/.*/fx/.*${symbolFragment}.*`);

    const result: SymbolTopicTable = fetchResult.results().map((r) => {
      const topicPath = r.path();
      const [, provider, , symbol] = topicPath.split("/");
      return { symbol, topicPath, provider };
    });
    return result;
  };

  const doSelect: ComboboxProps["onOptionSelect"] = (_event, data) => {
    const rows = data.selectedOptions.map((topicPath) => {
      const row = symbolTopicTable.find((row) => row.topicPath == topicPath);
      if (!row) {
        throw new Error(`Cannot find row for ${topicPath}`);
      }
      return row;
    });
    setSelectedOptions(rows);
  };

  const rows = query ? symbolTopicTable.filter((row) => row.symbol.includes(query.toUpperCase())) : symbolTopicTable;

  return (
    <>
      <Label>Search...</Label>&nbsp;
      <Combobox
        id="symbol-input"
        className={styles.searchBox}
        disabled={!session || !session.isConnected()}
        placeholder="Symbol"
        autoFocus
        autoCorrect="none"
        multiselect={rows.length > 0}
        onOptionSelect={doSelect}
        onChange={(ev) => setQuery(ev.target.value)}
        value={query}
        selectedOptions={selectedOptions.map((row) => row.topicPath)}
      >
        {rows.length === 0 ? (
          <Option key="no instrument" text="No instruments matching">
            No instruments matching {query}
          </Option>
        ) : (
          rows.map((row) => (
            <Option value={row.topicPath} key={row.topicPath} text={row.topicPath}>
              <CurrencyPairPersona row={row} query={query} />
            </Option>
          ))
        )}
      </Combobox>
    </>
  );
}

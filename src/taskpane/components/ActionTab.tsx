import * as React from "react";

import { Button, makeStyles } from "@fluentui/react-components";
import { DiffusionServerTable } from "../modules/DiffusionServerTable";
import { SymbolSearchBox } from "./SymbolSearchBox";
import { SymbolTopicRow } from "../modules/Common";
import { CurrencyPairPersona } from "./CurrencyPairPersona";
import { InstrumentTableViewer } from "../modules/InstrumentTableViewer";

const useStyles = makeStyles({
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export type ActionTabProps = {
  diffusionServerTable: DiffusionServerTable;

  selectedOptions: SymbolTopicRow[];
  setSelectedOptions: React.Dispatch<React.SetStateAction<SymbolTopicRow[]>>;

  tableViewer: InstrumentTableViewer | null;
  setTableViewer: React.Dispatch<React.SetStateAction<InstrumentTableViewer | undefined>>;
};

/**
 * The 'Action' tab - where users can search for currency pairs and click to stream live instrument data into Excel.
 * @param {ActionTabProps} props - The properties object.
 * @param {DiffusionServerTable} props.diffusionServerTable - The diffusion server table instance.
 * @returns {React.ReactElement} The rendered ActionTab component.
 */
export function ActionTab({
  diffusionServerTable,
  selectedOptions,
  setSelectedOptions,
  tableViewer,
  setTableViewer,
}: ActionTabProps) {
  const styles = useStyles();
  const [, forceRender] = React.useState(false);

  const session = diffusionServerTable.getFirst().session;

  const doStreamLiveData = async (row: SymbolTopicRow) => {
    if (!tableViewer) {
      await setTableViewer(await InstrumentTableViewer.build(session!, [row.topicPath]));
    } else {
      await tableViewer.addTopicPath(row.topicPath);
    }
    forceRender((prev) => !prev);
  };

  console.log("ActionTab render");
  return (
    <>
      <SymbolSearchBox session={session} selectedOptions={selectedOptions} setSelectedOptions={setSelectedOptions} />
      <ul>
        {selectedOptions.map((row) => (
          <li key={row.topicPath} className={styles.listItem}>
            <CurrencyPairPersona row={row} />
            <Button
              size="small"
              onClick={() => doStreamLiveData(row)}
              disabled={tableViewer?.hasTopicPath(row.topicPath)}
            >
              Live Data
            </Button>
            <Button size="small" disabled>
              1m Candlestick
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

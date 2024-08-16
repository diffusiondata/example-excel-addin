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
};

/**
 * The 'Action' tab - where users can search for currency pairs and click to stream live instrument data into Excel.
 * @param {ActionTabProps} props - The properties object.
 * @param {DiffusionServerTable} props.diffusionServerTable - The diffusion server table instance.
 * @returns {React.ReactElement} The rendered ActionTab component.
 */
export function ActionTab({ diffusionServerTable }: ActionTabProps) {
  const [selectedOptions, setSelectedOptions] = React.useState<SymbolTopicRow[]>([]);
  const [tableViewer, setTableViewer] = React.useState<InstrumentTableViewer>();
  const styles = useStyles();

  const session = diffusionServerTable.getFirst().session;

  const doStreamLiveData = async (row: SymbolTopicRow) => {
    if (!tableViewer) {
      setTableViewer(await InstrumentTableViewer.build(session!, [row.topicPath]));
    } else {
      tableViewer.addTopicPath(row.topicPath);
    }
  };

  return (
    <>
      <SymbolSearchBox session={session} selectedOptions={selectedOptions} setSelectedOptions={setSelectedOptions} />;
      <ul>
        {selectedOptions.map((row) => (
          <>
            <li className={styles.listItem}>
              <CurrencyPairPersona row={row} />
              <Button size="small" onClick={() => doStreamLiveData(row)}>
                Live Data
              </Button>
              <Button size="small" disabled>
                1m Candlestick{" "}
              </Button>
            </li>
          </>
        ))}
      </ul>
    </>
  );
}

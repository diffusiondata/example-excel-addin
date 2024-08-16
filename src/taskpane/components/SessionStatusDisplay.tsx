/* eslint-disable office-addins/call-sync-before-read, office-addins/load-object-before-read, react/react-in-jsx-scope */
import * as React from "react";

import { DiffusionServerTable } from "../modules/DiffusionServerTable";
import { makeStyles } from "@fluentui/react-components";
import clsx from "clsx";

const useStyles = makeStyles({
  sessionStatus: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    "background-color": "#f1f1f1",
    "text-align": "center",
    padding: "10px",
    fontSize: "smaller",
  },
  sessionStatusOK: {
    animation: "fadeToOriginal 2s",
    backgroundColor: "#eeffe6",
    animationName: {
      from: {
        backgroundColor: "#00ff00", // Starting with green
      },
      to: {
        backgroundColor: "#eeffe6", // Ending with the original background color
      },
    },
  },
});

export type SessionStatusDisplayProps = {
  diffusionServerTable: DiffusionServerTable;
};

/**
 * A React component that displays the status of the session to the Diffusion server.
 * @param {SessionStatusDisplayProps} props - the props for the component.
 * @returns {React.ReactElement} the component.
 */
export function SessionStatusDisplay({ diffusionServerTable }: SessionStatusDisplayProps): React.ReactElement {
  const styles = useStyles();
  const row = diffusionServerTable.getFirst();

  if (row.session?.isConnected()) {
    const url = new URL(row.serverLocation.url);
    url.username = row.serverLocation.principal;
    return <div className={clsx(styles.sessionStatus, styles.sessionStatusOK)}>Connected to {url.toString()}</div>;
  } else {
    return <div className={styles.sessionStatus}>Not connected</div>;
  }
}

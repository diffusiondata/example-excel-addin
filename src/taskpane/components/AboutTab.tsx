import * as React from "react";
import logo from "../../assets/addin-icon-128.png";
import dataFlowDiagram from "../../assets/data-flow.png";
import { makeStyles } from "@fluentui/react-components";
import clsx from "clsx";

const useStyles = makeStyles({
  centre: {
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  },

  right: {
    float: "right",
    marginLeft: "20px",
  },

  logo: {
    background: "darkgray",
    borderRadius: "10px",
  },

  code: {
    background: "#f4f4f4",
    fontSize: "small",
  },
});

/**
 * The AboutTab component displays information about the Add-In.
 */
export const AboutTab = React.memo(() => {
  const styles = useStyles();

  return (
    <div role="tabpanel" aria-labelledby="aboutTab">
      <img src={logo} className={clsx(styles.logo, styles.centre)} alt="logo" width="150" height="150" />
      <p>
        This is a minimal example implementation of an{" "}
        <a href="https://learn.microsoft.com/en-us/office/dev/add-ins/overview/office-add-ins">MS Office Add-In</a> for
        Excel, integrating with <a href="https://diffusiondata.com">Diffusion</a> to stream live market data into an
        Excel table.
      </p>

      <p>
        The Add-In makes use of <a href="https://reactjs.org/">React</a>,
        <a href="https://developer.microsoft.com/en-us/fluentui#/">Fluent UI</a>,
        <a href="https://learn.microsoft.com/en-us/office/dev/add-ins/develop/understanding-the-javascript-api-for-office">
          office.js
        </a>
        , and the <a href="https://docs.diffusiondata.com/docs/latest/js/">JavaScript Diffusion SDK</a>. It is written
        in TypeScript and uses <a href="https://vitejs.dev">Vite</a> for bundling.
      </p>

      <h2>Live data flow</h2>
      <img className={styles.right} alt="Data flow diagram" src={dataFlowDiagram} />
      <p>
        <code className={styles.code}>InstrumentTableView</code> encapsulates the streaming of live data from Diffusion
        to Excel and is written to prevent the streaming of live data faster than Excel can recalculate, which would
        rendering Excel unresponsive to user input.
      </p>
      <p>
        In broad terms, it receives topic updates from Diffusion and delivers them to an
        <code className={styles.code}>EventBatcher</code> to coalesce streams of updates into update batches. Batches
        are passed to the receiver function which categorizes updates into topic additions, updates, and removals, and
        then passes them to the <code className={styles.code}>TableViewer</code>.
      </p>

      <h3>EventBatcher</h3>
      <p>
        This class coalesces the stream of topic updates and delivers them as batches to an EventBatchReceiver function.
        A batch is delivered when its <code className={styles.code}>ready</code> promise resolves and no current call to
        the receiver is ongoing. A batch becomes ready when the number of events exceeds a threshold or a timeout is
        reached. This logic ensures that Excel is not overwhelmed.
      </p>

      <p>
        <strong>Scenario</strong>: The EventBatcher is configured with a batch size of 1,000 and a timeout of 100ms. A
        single update arrives for topic <code className={styles.code}>some/topic</code>. After 100ms, a batch holding
        the topic update is delivered to the receiver.
      </p>
      <p>
        <strong>Scenario</strong>: The EventBatcher is configured with a batch size of 1,000 and a timeout of 100ms.
        1,001 updates arrive for topic <code className={styles.code}>some/topic</code>. As soon as 1,000 updates are
        received, a batch holding the first 1,000 updates is delivered to the receiver, which completes immediately.
        After 100ms, the second batch is delivered, containing the remaining single update.
      </p>
      <p>
        <strong>Scenario</strong>: More realistically, the EventBatcher is configured with a batch size of 1,000 and a
        timeout of 100ms. 1,000 updates arrive from a broad set of unique topics. The EventBatcher delivers the batch of
        1,000 topic updates to the receiver, which ultimately waits for Excel while it recalculates a complex Excel
        table. <br />
        In the meantime, the EventBatcher receives further updates which it coalesces into a second batch. The second
        batch is delivered to the receiver function once the promise of the prior call is resolved.
      </p>

      <h3>TableViewer</h3>
      <p>
        The <code className={styles.code}>TableViewer</code> class encapsulates an{" "}
        <code className={styles.code}>Excel.Table</code> object and layers atop functionality so developers can interact
        with the table in terms of topic updates, instead of rows and columns. Row locations are indexed optimistically
        and rebuilt when the table is reordered.
      </p>
      <p>
        While the TableViewer is updating its content and all dependent Excel formulas are recalculating, the
        <code className={styles.code}>EventBatcher</code> continues to receive and coalesce updates from Diffusion.
      </p>

      <p>&nbsp;</p>
      <p>&nbsp;</p>
      <p>&nbsp;</p>
    </div>
  );
});

AboutTab.displayName = "AboutTab";

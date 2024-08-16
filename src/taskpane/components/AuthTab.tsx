import * as React from "react";
import * as diffusion from "diffusion";

import { Button, Input, Label, makeStyles, ToastIntent } from "@fluentui/react-components";
import { DiffusionServerTable } from "../modules/DiffusionServerTable";
import { DEFAULT_DIFFUSION_SERVER } from "../modules/AuthDefaults";
import { ConnectionDetail } from "../modules/ConnectionDetail";

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    rowGap: "10px",
  },
});

enum TestState {
  READY = "",
  CONNECTING = "Connecting",
  FAILED = "Failed",
  CONNECTED = "Connected",
}
export type AuthTabProps = {
  diffusionServerTable: DiffusionServerTable;
  toaster: (title: string, body: string, intent?: ToastIntent) => void;
};

/**
 * An incomplete component to handle authentication to a Diffusion server.
 * @param {AuthTabProps} props - The properties object.
 * @param {DiffusionServerTable} props.diffusionServerTable - The diffusion server table instance.
 * @param {Function} props.toaster - Function to display toast notifications.
 * @returns {React.ReactElement} The rendered AuthTab component.
 */
export function AuthTab({ diffusionServerTable, toaster }: AuthTabProps) {
  const styles = useStyles();
  const [principal, setPrincipal] = React.useState<string>(
    diffusionServerTable.getFirst().serverLocation.principal || ""
  );
  const [credentials, setCredentials] = React.useState<string>(
    diffusionServerTable.getFirst().serverLocation.credentials || ""
  );
  const [serverURL, setServerURL] = React.useState<string>(
    diffusionServerTable.getFirst().serverLocation.url.toString()
  );

  const [, setTestState] = React.useState<TestState>(TestState.READY);

  /**
   * Callback. Attempt to connect a session to the Diffusion server.
   * Successful connections are not stored.
   * @param {React.FormEvent} ev - the button click event
   */
  async function doSubmit(ev: React.FormEvent) {
    ev.preventDefault();

    const options = new ConnectionDetail(new URL(serverURL), principal, credentials).toOptions();
    setTestState(TestState.CONNECTING);

    try {
      const session = await diffusion.connect(options);
      console.log(`Connected to ${serverURL} as ${principal} as session ${session.sessionId}`);
      setTestState(TestState.CONNECTED);
      toaster("Connected", `Connected to ${serverURL} as ${principal}`);
    } catch (err) {
      console.log(`Cannot connect to ${serverURL}: ${err}`);
      toaster("Failed", `Cannot connect to ${serverURL}: ${err}`, "error");
      setTestState(TestState.FAILED);
    }
  }

  /**
   * Callback. Reset the user interface to the default values.
   */
  function doReset() {
    setPrincipal(DEFAULT_DIFFUSION_SERVER.serverLocation.principal || "");
    setCredentials(DEFAULT_DIFFUSION_SERVER.serverLocation.credentials || "");
    setServerURL(DEFAULT_DIFFUSION_SERVER.serverLocation.url.toString());
  }

  return (
    <form className={styles.content} onSubmit={doSubmit}>
      <Label required htmlFor="principal">
        Principal
      </Label>
      <Input
        required
        id="principal"
        type="text"
        name="principal"
        value={principal}
        onChange={(ev) => setPrincipal(ev.target.value)}
        placeholder="Username"
      />

      <Label required htmlFor="credentials">
        Credentials
      </Label>
      <Input
        required
        id="credentials"
        type="password"
        name="credentials"
        value={credentials}
        onChange={(ev) => setCredentials(ev.target.value)}
        placeholder="Password"
      />

      <Label required htmlFor="serverURL">
        URL
      </Label>
      <Input
        required
        id="serverURL"
        type="url"
        name="serverURL"
        value={serverURL}
        onChange={(ev) => setServerURL(ev.target.value)}
        placeholder="wss://some-host.example.com/"
      />

      <Button type="reset" appearance="secondary" onClick={doReset}>
        Reset
      </Button>
      <Button type="submit" appearance="primary">
        Connect
      </Button>
    </form>
  );
}

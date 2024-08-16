import * as React from "react";
import * as diffusion from "diffusion";
import {
  makeStyles,
  shorthands,
  tokens,
  Tab,
  TabList,
  TabValue,
  SelectTabEvent,
  SelectTabData,
  useToastController,
  useId,
  Toast,
  ToastBody,
  ToastIntent,
  ToastTitle,
  Toaster,
} from "@fluentui/react-components";
import {
  bundleIcon,
  InfoFilled,
  InfoRegular,
  PasswordRegular,
  PasswordFilled,
  CalendarDataBarRegular,
  CalendarDataBarFilled,
} from "@fluentui/react-icons";
import { ActionTab } from "./ActionTab";
import { AboutTab } from "./AboutTab";
import { DiffusionServerTable } from "../modules/DiffusionServerTable";
import { SessionStatusDisplay } from "./SessionStatusDisplay";
import { AuthTab } from "./AuthTab";
import { DEFAULT_DIFFUSION_SERVER } from "../modules/AuthDefaults";

const MarketIcon = bundleIcon(CalendarDataBarRegular, CalendarDataBarFilled);
const AboutIcon = bundleIcon(InfoFilled, InfoRegular);
const PasswordIcon = bundleIcon(PasswordFilled, PasswordRegular);

const useStyles = makeStyles({
  root: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    ...shorthands.padding("5px", "5px"),
    rowGap: "20px",
  },
  panels: {
    ...shorthands.padding(0, "10px"),
    "& th": {
      textAlign: "left",
      ...shorthands.padding(0, "30px", 0, 0),
    },
    width: "95%",
  },
  propsTable: {
    "& td:first-child": {
      fontWeight: tokens.fontWeightSemibold,
    },
    "& td": {
      ...shorthands.padding(0, "30px", 0, 0),
    },
  },
});

/**
 * The root component for the add-in.
 * @returns {React.ReactElement} the root React component.
 */
export default function App() {
  const styles = useStyles();
  const [selectedValue, setSelectedValue] = React.useState<TabValue>("aboutTab");
  const [diffusionServerTable, setDiffusionServerTable] = React.useState<DiffusionServerTable>(
    DiffusionServerTable.from([DEFAULT_DIFFUSION_SERVER])
  );

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const raiseToast = (title: string, body: string, intent: ToastIntent = "success") =>
    dispatchToast(
      <Toast>
        <ToastTitle>{title}</ToastTitle>
        <ToastBody>{body}</ToastBody>
      </Toast>,
      { intent: intent, position: "bottom-end" }
    );

  /**
   * Callback. Connect a session to the default Diffusion server.
   * Stores a successful connection in `diffusionServerTable`.
   */
  async function doConnect(): Promise<void> {
    const row = diffusionServerTable.get(DEFAULT_DIFFUSION_SERVER.key)!;
    try {
      const session = await diffusion.connect(row.serverLocation.toOptions());
      console.debug(
        `Connected to ${row.serverLocation.url} as ${row.serverLocation.principal} → session ${session.sessionId}`
      );
      const newTable = diffusionServerTable.clone();
      newTable.get(row.key)!.session = session;
      setDiffusionServerTable(newTable);
    } catch (err) {
      console.error(`Cannot connect to ${row.serverLocation.url} as ${row.serverLocation.principal}: ${err}`);
    }
  }

  React.useEffect(() => {
    doConnect();
  }, []);

  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedValue(data.value);
  };

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className={styles.root}>
        <TabList selectedValue={selectedValue} onTabSelect={onTabSelect} appearance="subtle">
          <Tab value="actionTab" icon={<MarketIcon />}>
            Market Data
          </Tab>
          <Tab value="authTab" icon={<PasswordIcon />}>
            Authentication
          </Tab>
          <Tab value="aboutTab" icon={<AboutIcon />}>
            About
          </Tab>
        </TabList>
        <div className={styles.panels}>
          {selectedValue === "actionTab" && <ActionTab diffusionServerTable={diffusionServerTable} />}
          {selectedValue === "aboutTab" && <AboutTab />}
          {selectedValue === "authTab" && <AuthTab diffusionServerTable={diffusionServerTable} toaster={raiseToast} />}
        </div>
      </div>
      <SessionStatusDisplay diffusionServerTable={diffusionServerTable} />
    </>
  );
}

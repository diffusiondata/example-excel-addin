import { ConnectionDetail } from "./ConnectionDetail";
import { DiffusionServerRow } from "./DiffusionServerTable";

/**
 * The default Diffusion server configuration.
 */
export const DEFAULT_DIFFUSION_SERVER: DiffusionServerRow = {
  key: "23ad930d-3aa4-4004-b935-d1ddf90dd246",
  // The Diffusion server details. Change this to match your environment.
  // You *must* use a secure connection (wss://) for the add-in to work.
  serverLocation: new ConnectionDetail(new URL("wss://diffusion.example.com"), "some-user", "some-password"),
  session: null,
};

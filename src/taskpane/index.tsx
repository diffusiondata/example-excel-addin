import React from "react";
import App from "./components/App";
import { initializeIcons } from "@fluentui/font-icons-mdl2";
import { ThemeProvider } from "@fluentui/react/lib/Theme";
import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

/* global document, Office */

initializeIcons();

/**
 * The application entry point of the application.
 * @param {typeof App} Component the root component of the application.
 */
const render = (Component: typeof App) => {
  createRoot(document.getElementById("container") as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <FluentProvider theme={webLightTheme}>
          <Component />
        </FluentProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
};

/* Render application after Office initializes */
Office.onReady(() => {
  render(App);
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setTokenProvider } from "./lib/api";
import { getAccessToken, applyStoredAccent } from "./lib/session";
import "./styles.css";
import "./styles/base.css";
import "./styles/shell.css";

applyStoredAccent();
setTokenProvider(getAccessToken);

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

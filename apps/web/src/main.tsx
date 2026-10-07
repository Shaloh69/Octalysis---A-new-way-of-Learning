import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setTokenProvider } from "./lib/api";
import { getAccessToken, applyStoredAccent } from "./lib/session";
import "./styles.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/map.css";
import "./styles/reader.css";
import "./styles/runner.css";
import "./styles/stages.css";
import "./styles/progress.css";
import "./styles/work.css";
import "./styles/settings.css";
import "./styles/news.css";
import "./styles/chat.css";
import "./styles/title.css";

applyStoredAccent();
setTokenProvider(getAccessToken);

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

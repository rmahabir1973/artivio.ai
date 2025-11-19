import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeAuthBridge } from "./lib/authBridge";

// CRITICAL: Initialize auth bridge BEFORE React renders
// This ensures all bundle chunks (including lazy-loaded routes) see the auth context
initializeAuthBridge();

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import "./styles.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<AppShell />);

import { createRoot } from "react-dom/client";
import "./index.css";
import CamPage from "./components/CamPage";
import Dashboard from "./components/Dashboard";

const isCam = window.location.pathname.replace(/\/+$/, "") === "/cam";
document.title = isCam ? "Bullhorn · Rover camera" : "Bullhorn";

createRoot(document.getElementById("root")!).render(isCam ? <CamPage /> : <Dashboard />);

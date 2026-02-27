import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply dark mode from localStorage on initial load
const savedTheme = localStorage.getItem('nuru-ui-theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById("root")!).render(<App />);

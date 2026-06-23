import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Router envuelve toda la app */}
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
          {/* # Toaster global: vive fuera de las rutas para no desmontarse al navegar. */}
          <Toaster
            position="top-right"
            duration={3000}
            closeButton
            richColors
            theme="dark"
          />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);

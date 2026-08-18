import { useState } from "react";
import { clearSettings, loadSettings, saveSettings, type Settings } from "./lib/settings";
import { SettingsScreen } from "./components/Settings";
import { StoreProvider, useStore } from "./store";
import { useRoute, paths } from "./router";
import { IndexPage } from "./pages/Index";
import { NewPage } from "./pages/New";
import { ShowPage } from "./pages/Show";
import { LogsPage } from "./pages/Logs";

export function App() {
  const [settings, setSettings] = useState<Settings | null>(() => loadSettings());
  const [editing, setEditing] = useState(false);

  if (!settings || editing) {
    return (
      <SettingsScreen
        initial={settings}
        onCancel={settings ? () => setEditing(false) : undefined}
        onConnected={(s) => {
          saveSettings(s);
          setSettings(s);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <StoreProvider key={settings.baseUrl + settings.apiKey} settings={settings}>
      <Shell
        onSettings={() => setEditing(true)}
        onSignOut={() => {
          clearSettings();
          setSettings(null);
        }}
      />
    </StoreProvider>
  );
}

function Shell({ onSettings, onSignOut }: { onSettings: () => void; onSignOut: () => void }) {
  const route = useRoute();
  const { connected, client } = useStore();
  return (
    <div className="app">
      <nav className="topbar">
        <a href={paths.index} className="brand">
          ⛲ Conversations
        </a>
        <span className={`link-dot ${connected ? "on" : "off"}`} title={connected ? "Live" : "Reconnecting…"} />
        <span className="muted small host">{client.baseUrl.replace(/^https?:\/\//, "")}</span>
        <span className="spacer" />
        <a href={paths.new()} className="button small">
          New
        </a>
        <button className="icon" onClick={onSettings} title="Settings" aria-label="Settings">
          ⚙
        </button>
        <button className="secondary small" onClick={onSignOut} title="Forget this key">
          Sign out
        </button>
      </nav>
      <main className="main">
        {route.page === "index" && <IndexPage />}
        {route.page === "new" && <NewPage parentId={route.parentId} />}
        {route.page === "show" && <ShowPage key={route.id} id={route.id} />}
        {route.page === "logs" && <LogsPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}

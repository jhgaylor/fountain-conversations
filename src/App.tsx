import { useEffect, useState } from "react";
import { clearSettings, loadSettings, saveSettings, type Settings } from "./lib/settings";
import { SettingsScreen } from "./components/Settings";
import { completeLoginIfCallback, revoke } from "./lib/oauth";
import { FountainClient } from "./api/client";
import { StoreProvider, useStore } from "./store";
import { useRoute, paths } from "./router";
import { IndexPage } from "./pages/Index";
import { NewPage } from "./pages/New";
import { ShowPage } from "./pages/Show";
import { LogsPage } from "./pages/Logs";
import { AgentsPage } from "./pages/Agents";
import { AgentFormPage } from "./pages/AgentForm";
import { EnvironmentsPage, EnvironmentFormPage } from "./pages/Environments";
import { VaultsPage, VaultFormPage } from "./pages/Vaults";

export function App() {
  const [settings, setSettings] = useState<Settings | null>(() => loadSettings());
  const [editing, setEditing] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(() => /[?&](code|error)=/.test(window.location.search));
  const [oauthError, setOauthError] = useState<string | null>(null);

  // If we came back from Fountain's consent page, finish the exchange before
  // rendering anything else.
  useEffect(() => {
    completeLoginIfCallback()
      .then(async (result) => {
        if (!result) return;
        const s: Settings = { baseUrl: result.baseUrl, apiKey: result.apiKey, via: "oauth" };
        try {
          await new FountainClient(s).me();
          saveSettings(s);
          setSettings(s);
        } catch {
          setOauthError("Signed in, but that Fountain could not be reached.");
        }
      })
      .catch((err) => setOauthError(err instanceof Error ? err.message : String(err)))
      .finally(() => setOauthBusy(false));
  }, []);

  if (oauthBusy) {
    return <div className="settings"><div className="settings-card"><h1>Signing in…</h1></div></div>;
  }

  if (!settings || editing) {
    return (
      <SettingsScreen
        initial={settings}
        error={oauthError}
        onCancel={settings ? () => setEditing(false) : undefined}
        onConnected={(s) => {
          saveSettings(s);
          setSettings(s);
          setEditing(false);
          setOauthError(null);
        }}
      />
    );
  }
  return (
    <StoreProvider key={settings.baseUrl + settings.apiKey} settings={settings}>
      <Shell
        onSettings={() => setEditing(true)}
        onSignOut={() => {
          if (settings.via === "oauth") void revoke(settings.baseUrl, settings.apiKey);
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
          ⛲ Fountain
        </a>
        <a href={paths.index} className={`navlink ${route.page === "index" || route.page === "new" || route.page === "show" || route.page === "logs" ? "on" : ""}`}>
          Conversations
        </a>
        <a href={paths.agents} className={`navlink ${route.page === "agents" || route.page === "agent" ? "on" : ""}`}>
          Agents
        </a>
        <a href={paths.environments} className={`navlink ${route.page === "environments" || route.page === "environment" ? "on" : ""}`}>
          Environments
        </a>
        <a href={paths.vaults} className={`navlink ${route.page === "vaults" || route.page === "vault" ? "on" : ""}`}>
          Vaults
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
        {route.page === "agents" && <AgentsPage />}
        {route.page === "agent" && <AgentFormPage key={route.id} id={route.id} />}
        {route.page === "environments" && <EnvironmentsPage />}
        {route.page === "environment" && <EnvironmentFormPage key={route.id} id={route.id} />}
        {route.page === "vaults" && <VaultsPage />}
        {route.page === "vault" && <VaultFormPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}

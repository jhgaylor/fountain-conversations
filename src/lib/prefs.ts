/** Per-browser view preferences (the server keeps its own for the web UI). */
export type ViewMode = "chat" | "timeline";

const KEY = "fountain-conversations.prefs";

interface Prefs {
  viewMode: ViewMode;
  visibleStreams: string[];
  rootsOnly: boolean;
  sort: "activity" | "created";
}

const DEFAULTS: Prefs = { viewMode: "chat", visibleStreams: ["acp", "stdout", "stderr", "stage"], rootsOnly: false, sort: "activity" };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Partial<Prefs>): Prefs {
  const next = { ...loadPrefs(), ...p };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

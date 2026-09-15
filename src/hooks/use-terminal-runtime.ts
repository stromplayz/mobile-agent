import { useCallback, useEffect, useRef, useState } from "react";
import { closeTerminalSession, createTerminalSession, execOnce, getBootstrapStatus, installBootstrap, installTerminalPackage, isTerminalRuntimeAvailable, sendTerminalInput, subscribeToTerminalRuntime, type TerminalBootstrapStatus, type TerminalSessionInfo, type TerminalStreamEvent } from "terminal-runtime";

export type TerminalRuntimeState = {
  available: boolean;
  bootstrap: TerminalBootstrapStatus;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  transcript: string;
  installingBootstrap: boolean;
  bootstrapProgress: number;
};

export function useTerminalRuntime() {
  const [available] = useState(isTerminalRuntimeAvailable());
  const [bootstrap, setBootstrap] = useState<TerminalBootstrapStatus>({ ready: false, root: "", supported: false });
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [installingBootstrap, setInstallingBootstrap] = useState(false);
  const [bootstrapProgress, setBootstrapProgress] = useState(0);
  const transcriptRef = useRef("");
  const activeSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!available) return;
    const unsubscribe = subscribeToTerminalRuntime((event: TerminalStreamEvent) => {
      switch (event.type) {
        case "output": if (event.sessionId === activeSessionRef.current) { transcriptRef.current += event.data; setTranscript(transcriptRef.current); } break;
        case "exit": if (event.sessionId === activeSessionRef.current) { transcriptRef.current += `\n[exit ${event.exitCode}]\n`; setTranscript(transcriptRef.current); } break;
        case "error": if (event.sessionId === activeSessionRef.current) { transcriptRef.current += `\n[error: ${event.message}]\n`; setTranscript(transcriptRef.current); } break;
        case "bootstrapProgress": setBootstrapProgress(event.percent); break;
      }
    });
    return unsubscribe;
  }, [available]);

  useEffect(() => { if (available) getBootstrapStatus().then(setBootstrap).catch(() => {}); }, [available]);

  const refreshBootstrap = useCallback(async () => { const s = await getBootstrapStatus(); setBootstrap(s); return s; }, []);
  const startBootstrapInstall = useCallback(async () => { if (!available) return { ok: false }; setInstallingBootstrap(true); setBootstrapProgress(0); try { const r = await installBootstrap(); await refreshBootstrap(); return r; } finally { setInstallingBootstrap(false); } }, [available, refreshBootstrap]);
  const createSession = useCallback(async (input: { name?: string; cwd?: string; shell?: string; useBootstrap?: boolean }) => {
    if (!available) return null;
    const session = await createTerminalSession(input);
    if (session) { setSessions((prev) => [...prev.filter((s) => s.id !== session.id), session]); setActiveSessionId(session.id); activeSessionRef.current = session.id; transcriptRef.current = ""; setTranscript(""); }
    return session;
  }, [available]);
  const selectSession = useCallback((id: string | null) => { setActiveSessionId(id); activeSessionRef.current = id; transcriptRef.current = ""; setTranscript(""); }, []);
  const closeSession = useCallback(async (id: string) => { await closeTerminalSession(id); setSessions((prev) => prev.filter((s) => s.id !== id)); if (activeSessionRef.current === id) { setActiveSessionId(null); activeSessionRef.current = null; transcriptRef.current = ""; setTranscript(""); } }, []);
  const sendInput = useCallback(async (data: string) => { if (activeSessionRef.current) await sendTerminalInput(activeSessionRef.current, data); }, []);
  const installPackage = useCallback(async (pkg: string, cwd?: string) => installTerminalPackage({ pkg, cwd }), []);

  return { available, bootstrap, sessions, activeSessionId, transcript, installingBootstrap, bootstrapProgress, refreshBootstrap, startBootstrapInstall, createSession, selectSession, closeSession, sendInput, installPackage };
}

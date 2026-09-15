import { Plus, Play, Square, Package, RefreshCw, Terminal as TerminalIcon, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { BrutalistContainer, BrutalistMasterDetail } from "@/components/brutalist/container";
import { useBrutalist } from "@/hooks/use-brutalist";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTerminalRuntime } from "@/hooks/use-terminal-runtime";

export default function TerminalScreen() {
  const b = useBrutalist();
  const { isTablet } = useResponsiveLayout();
  const rt = useTerminalRuntime();
  const [input, setInput] = useState("");
  const [installPkg, setInstallPkg] = useState("");
  const [installingPkg, setInstallingPkg] = useState(false);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { if (rt.transcript) requestAnimationFrame(() => { scrollRef.current?.scrollToEnd({ animated: false }); }); }, [rt.transcript]);

  const handleSubmit = useCallback(async () => { const cmd = input; if (!cmd) return; setInput(""); await rt.sendInput(cmd + "\n"); }, [input, rt]);
  const handleInstallPkg = useCallback(async () => {
    if (!installPkg.trim()) return;
    setInstallingPkg(true); setInstallResult(null);
    try { const r = await rt.installPackage(installPkg.trim()); setInstallResult(`[exit ${r.exitCode}]\n${r.stdout}\n${r.stderr}`.trim()); }
    finally { setInstallingPkg(false); }
  }, [installPkg, rt]);

  if (!rt.available) {
    return (<BrutalistContainer><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}><TerminalIcon color={b.muted} size={48} /><Text style={b.bodyMuted}>Terminal runtime is only available on Android.</Text></View></BrutalistContainer>);
  }

  const header = (<><TerminalIcon color={b.fg} size={20} /><Text style={[b.h2, { flex: 1 }]}>Terminal</Text><Pressable onPress={() => rt.refreshBootstrap()} hitSlop={8}><RefreshCw color={b.fg} size={16} /></Pressable><Pressable onPress={() => rt.createSession({ name: `session-${rt.sessions.length + 1}` })} hitSlop={8}><Plus color={b.fg} size={18} /></Pressable></>);

  const bootstrapBanner = (
    <View style={[b.surface, { padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={b.h3}>Bootstrap {rt.bootstrap.ready ? "Ready" : "Not Installed"}</Text>
        <Text style={b.bodyMuted}>{rt.bootstrap.ready ? "Full Linux environment available." : "Using system shell. Install bootstrap for full env."}</Text>
      </View>
      {!rt.bootstrap.ready ? (
        <Pressable onPress={() => rt.startBootstrapInstall()} disabled={rt.installingBootstrap} style={[b.buttonPrimary, { opacity: rt.installingBootstrap ? 0.5 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Package color={b.accentFg} size={14} /><Text style={b.buttonPrimaryText}>{rt.installingBootstrap ? `${rt.bootstrapProgress}%` : "Install"}</Text></View>
        </Pressable>
      ) : null}
    </View>
  );

  const renderSessionItem = (s: { id: string; name: string }, active: boolean) => (
    <Pressable key={s.id} onPress={() => rt.selectSession(s.id)} style={({ pressed }) => [b.surface, { paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1, backgroundColor: active ? b.accent : b.bg }]}>
      <View style={{ width: 8, height: 8, backgroundColor: active ? b.accentFg : b.fg }} />
      <Text numberOfLines={1} style={[b.mono, { flex: 1, color: active ? b.accentFg : b.fg, fontWeight: "900" }]}>{s.name}</Text>
      <Pressable hitSlop={8} onPress={() => rt.closeSession(s.id)}><X color={active ? b.accentFg : b.fg} size={12} /></Pressable>
    </Pressable>
  );

  const transcriptPane = (
    <View style={{ flex: 1, gap: 8 }}>
      {bootstrapBanner}
      <View style={[b.surface, { flex: 1, backgroundColor: "#0A0A0A", borderColor: b.border, padding: 8 }]}>
        {!rt.activeSessionId ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><Play color="#10B981" size={28} /><Text style={[b.bodyMuted, { color: "#666" }]}>No active session. Tap + to start.</Text></View>
        ) : (
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ gap: 4, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 18, color: "#10B981" }}>{rt.transcript || "$ ready.\n"}</Text>
          </ScrollView>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Package color={b.muted} size={14} />
        <TextInput value={installPkg} onChangeText={setInstallPkg} placeholder="install package (e.g. python)" placeholderTextColor={b.muted} style={[b.input, { flex: 1, paddingVertical: 8 }]} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleInstallPkg} />
        <Pressable onPress={handleInstallPkg} disabled={installingPkg || !installPkg.trim()} style={[b.buttonGhost, { opacity: installingPkg || !installPkg.trim() ? 0.5 : 1 }]}><Text style={b.buttonGhostText}>{installingPkg ? "..." : "Install"}</Text></Pressable>
      </View>
      {installResult ? (<ScrollView style={[b.surface, { maxHeight: 120, backgroundColor: "#0A0A0A", borderColor: b.border, padding: 8 }]} showsVerticalScrollIndicator><Text style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 16, color: "#CCC" }}>{installResult}</Text></ScrollView>) : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontFamily: "monospace", fontWeight: "900", fontSize: 16, color: b.fg }}>$</Text>
          <TextInput value={input} onChangeText={setInput} placeholder="type a command and press Enter" placeholderTextColor={b.muted} style={[b.input, { flex: 1, paddingVertical: 8 }]} autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={handleSubmit} editable={!!rt.activeSessionId} />
          <Pressable onPress={handleSubmit} disabled={!rt.activeSessionId || !input} style={[b.buttonPrimary, { opacity: !rt.activeSessionId || !input ? 0.5 : 1 }]}><Text style={b.buttonPrimaryText}>Run</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  if (isTablet) {
    return (
      <BrutalistContainer header={header} pad={false}>
        <BrutalistMasterDetail masterWidth={300} master={
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={b.label}>Sessions ({rt.sessions.length})</Text>
            {rt.sessions.length === 0 ? <Text style={b.bodyMuted}>No sessions. Tap + above.</Text> : rt.sessions.map((s) => renderSessionItem(s, s.id === rt.activeSessionId))}
          </View>
        } detail={<View style={{ padding: 16, flex: 1 }}>{transcriptPane}</View>} />
      </BrutalistContainer>
    );
  }
  return (
    <BrutalistContainer header={header}>
      {rt.sessions.length > 0 ? (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>{rt.sessions.map((s) => renderSessionItem(s, s.id === rt.activeSessionId))}</ScrollView>) : null}
      {transcriptPane}
    </BrutalistContainer>
  );
}

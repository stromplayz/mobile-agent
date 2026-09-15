import { useRouter } from "expo-router";
import { Play, Users, Workflow, CheckCircle2, XCircle, Loader, X, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BrutalistContainer } from "@/components/brutalist/container";
import { useBrutalist } from "@/hooks/use-brutalist";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useFeatureStore } from "@/providers/feature-store";
import { useConfig } from "@/hooks/use-config";
import { DEFAULT_WORKER_TEMPLATES } from "@/modules/multi-agent/templates";
import type { AgentConfig, ParallelRun, ParallelRunWorker } from "@/core/types/app-state";

export default function MultiAgentScreen() {
  const b = useBrutalist();
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const { agents } = useConfig();
  const { parallelRuns, parallelRunWorkers, hydrating, startParallelRun, activeProjectId } = useFeatureStore();
  const [launching, setLaunching] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const candidateWorkers = agents.filter((a: AgentConfig) => a.enabled && (a.mode === "subagent" || a.mode === "all"));
  const toggleWorker = useCallback((id: string) => { setSelectedWorkerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }, []);
  const handleLaunch = useCallback(async () => { if (!taskInput.trim() || selectedWorkerIds.length < 1) return; setLaunching(true); try { const runId = await startParallelRun({ task: taskInput.trim(), workerAgentIds: selectedWorkerIds, projectId: activeProjectId }); setTaskInput(""); setSelectedWorkerIds([]); setPickerOpen(false); if (runId) router.push(`/multi-agent/${runId}`); } finally { setLaunching(false); } }, [taskInput, selectedWorkerIds, activeProjectId, startParallelRun, router]);

  const header = (<><Workflow color={b.fg} size={20} /><Text style={[b.h2, { flex: 1 }]}>Multi-Agent Runs</Text></>);

  const launcherCard = (
    <View style={[b.surface, { padding: 12, marginBottom: 12 }]}>
      <Text style={b.h3}>Start A New Parallel Run</Text>
      <Text style={[b.bodyMuted, { marginTop: 4, marginBottom: 8 }]}>Decompose a task into 2-4 subtasks, dispatch to parallel workers, merge.</Text>
      <TextInput style={[b.input, { minHeight: 80 }]} placeholder="Describe the task to parallelize…" placeholderTextColor={b.muted} value={taskInput} onChangeText={setTaskInput} multiline numberOfLines={3} textAlignVertical="top" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
        <Text style={b.label}>{selectedWorkerIds.length} Worker{selectedWorkerIds.length === 1 ? "" : "s"}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setPickerOpen(true)} style={({ pressed }) => [b.buttonGhost, { opacity: pressed ? 0.7 : 1 }]}><Text style={b.buttonGhostText}>Pick Workers</Text></Pressable>
          <Pressable onPress={handleLaunch} disabled={launching || !taskInput.trim() || selectedWorkerIds.length < 1} style={[b.buttonPrimary, { flexDirection: "row", alignItems: "center", gap: 6, opacity: launching || !taskInput.trim() || selectedWorkerIds.length < 1 ? 0.5 : 1 }]}><Play color={b.accentFg} size={12} /><Text style={b.buttonPrimaryText}>{launching ? "..." : "Launch"}</Text></Pressable>
        </View>
      </View>
    </View>
  );

  const templatesCard = (
    <View style={[b.surface, { padding: 12, marginBottom: 12 }]}>
      <Text style={b.label}>Default Worker Templates</Text>
      <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {DEFAULT_WORKER_TEMPLATES.map((t) => (<View key={t.name} style={[b.pill, { paddingVertical: 4, paddingHorizontal: 6 }]}><Text style={b.pillText}>{t.name}</Text></View>))}
      </View>
      <Text style={[b.bodyMuted, { marginTop: 6, fontSize: 11 }]}>Roles the orchestrator can assign. Create matching agents in Settings → Agents.</Text>
    </View>
  );

  const renderRunRow = ({ item }: { item: ParallelRun }) => {
    const workers = parallelRunWorkers.filter((w) => w.parallelRunId === item.id);
    const completed = workers.filter((w) => w.status === "completed").length;
    const failed = workers.filter((w) => w.status === "failed").length;
    const running = workers.filter((w) => w.status === "running").length;
    const statusColor = item.status === "completed" ? b.fg : item.status === "failed" ? b.dangerBg : b.muted;
    return (
      <Pressable onPress={() => router.push(`/multi-agent/${item.id}`)} style={({ pressed }) => [b.surface, { padding: 10, opacity: pressed ? 0.7 : 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={[b.mono, { flex: 1, fontWeight: "900", color: b.fg }]}>{item.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {running > 0 ? <Loader color={b.muted} size={12} /> : item.status === "completed" ? <CheckCircle2 color={statusColor} size={12} /> : item.status === "failed" ? <XCircle color={statusColor} size={12} /> : null}
            <Text style={[b.pillText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={[b.bodyMuted, { marginTop: 4, fontSize: 11 }]}>{item.task}</Text>
        <View style={{ marginTop: 4, flexDirection: "row", gap: 8 }}>
          <Text style={[b.pillText, { color: b.muted }]}>{workers.length} Workers</Text>
          {completed > 0 ? <Text style={[b.pillText, { color: b.fg }]}>{completed} Done</Text> : null}
          {failed > 0 ? <Text style={[b.pillText, { color: b.dangerBg }]}>{failed} Failed</Text> : null}
        </View>
      </Pressable>
    );
  };

  const workerPicker = (
    <BrutalistWorkerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} candidateWorkers={candidateWorkers} selectedWorkerIds={selectedWorkerIds} toggleWorker={toggleWorker} />
  );

  if (isTablet) {
    return (
      <BrutalistContainer header={header} pad={false}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ width: 420, borderRightWidth: 2, borderRightColor: b.border, padding: 16 }}>
            <ScrollView showsVerticalScrollIndicator={false}>{launcherCard}{templatesCard}</ScrollView>
          </View>
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={[b.h3, { marginBottom: 8 }]}>Recent Runs</Text>
            <FlatList data={parallelRuns} keyExtractor={(item) => item.id} renderItem={renderRunRow} ItemSeparatorComponent={() => (<View style={{ height: 4 }} />)}
              ListEmptyComponent={hydrating ? (<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 }}><ActivityIndicator color={b.muted} size="small" /><Text style={b.bodyMuted}>Loading runs…</Text></View>) : (<View style={{ alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 32 }}><Users color={b.muted} size={32} /><Text style={b.bodyMuted}>No parallel runs yet.</Text></View>)}
              contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} />
          </View>
        </View>
        {workerPicker}
      </BrutalistContainer>
    );
  }
  return (
    <BrutalistContainer header={header}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {launcherCard}{templatesCard}
        <Text style={[b.h3, { marginBottom: 8 }]}>Recent Runs</Text>
        <FlatList
          data={parallelRuns}
          keyExtractor={(item) => item.id}
          renderItem={renderRunRow}
          ItemSeparatorComponent={FlatListItemSeparator}
          ListEmptyComponent={hydrating ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 }}>
              <ActivityIndicator color={b.muted} size="small" />
              <Text style={b.bodyMuted}>Loading runs…</Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 32 }}>
              <Users color={b.muted} size={32} />
              <Text style={b.bodyMuted}>No parallel runs yet.</Text>
            </View>
          )}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </ScrollView>
      {workerPicker}
    </BrutalistContainer>
  );
}

function BrutalistWorkerPicker({ open, onClose, candidateWorkers, selectedWorkerIds, toggleWorker }: { open: boolean; onClose: () => void; candidateWorkers: AgentConfig[]; selectedWorkerIds: string[]; toggleWorker: (id: string) => void; }) {
  const b = useBrutalist();
  if (!open) return null;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: b.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.5)", zIndex: 100, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={[b.surface, { width: "100%", maxWidth: 520, padding: 16, shadowColor: b.fg, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6, backgroundColor: b.bg }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={b.h3}>Pick Worker Agents</Text>
          <Pressable hitSlop={8} onPress={onClose}><X color={b.fg} size={16} /></Pressable>
        </View>
        <Text style={[b.bodyMuted, { marginBottom: 12 }]}>Select 2-4 agents to act as workers.</Text>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {candidateWorkers.length === 0 ? <Text style={b.bodyMuted}>No enabled agents. Create agents in Settings → Agents.</Text> : candidateWorkers.map((agent: AgentConfig) => {
            const selected = selectedWorkerIds.includes(agent.id);
            return (
              <Pressable key={agent.id} onPress={() => toggleWorker(agent.id)} style={({ pressed }) => [b.surface, { padding: 10, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1, backgroundColor: selected ? b.accent : b.bg }]}>
                <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: b.border, backgroundColor: selected ? b.accentFg : "transparent", alignItems: "center", justifyContent: "center" }}>{selected ? <Check color={b.accent} size={12} strokeWidth={4} /> : null}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[b.mono, { fontWeight: "900", color: selected ? b.accentFg : b.fg }]}>{agent.name}</Text>
                  {agent.description ? <Text numberOfLines={1} style={[b.bodyMuted, { color: selected ? b.accentFg : b.muted, fontSize: 11 }]}>{agent.description}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable onPress={onClose} style={[b.buttonGhost, { flex: 1 }]}><Text style={b.buttonGhostText}>Cancel</Text></Pressable>
          <Pressable onPress={onClose} disabled={selectedWorkerIds.length < 1} style={[b.buttonPrimary, { flex: 1, opacity: selectedWorkerIds.length < 1 ? 0.5 : 1 }]}><Text style={b.buttonPrimaryText}>Done ({selectedWorkerIds.length})</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function FlatListItemSeparator() {
  const b = useBrutalist();
  return <View style={{ height: 4 }} />;
}


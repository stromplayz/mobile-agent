import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CheckCircle2, XCircle, Loader } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrutalistContainer } from "@/components/brutalist/container";
import { useBrutalist } from "@/hooks/use-brutalist";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useFeatureStore } from "@/providers/feature-store";

export default function ParallelRunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const b = useBrutalist();
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const { parallelRuns, parallelRunWorkers, hydrating } = useFeatureStore();
  const run = useMemo(() => parallelRuns.find((r) => r.id === id) ?? null, [parallelRuns, id]);
  const workers = useMemo(() => run ? parallelRunWorkers.filter((w) => w.parallelRunId === run.id) : [], [parallelRunWorkers, run]);

  const header = (<><Pressable onPress={() => router.back()} hitSlop={8}><ChevronLeft color={b.fg} size={20} /></Pressable><Text style={[b.h2, { flex: 1 }]} numberOfLines={1}>{run?.title ?? "Parallel Run"}</Text></>);

  if (!run) return (<BrutalistContainer header={header}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><Text style={b.bodyMuted}>{hydrating ? "Loading…" : "This run no longer exists."}</Text></View></BrutalistContainer>);

  const statusColor = run.status === "completed" ? b.fg : run.status === "failed" ? b.dangerBg : b.muted;
  const taskCard = (
    <View style={[b.surface, { padding: 12, marginBottom: 12 }]}>
      <Text style={b.label}>Task</Text>
      <Text style={[b.body, { marginTop: 4 }]}>{run.task}</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        <View style={[b.pill, { paddingVertical: 3, paddingHorizontal: 8 }]}><Text style={[b.pillText, { color: statusColor }]}>{run.status}</Text></View>
        <Text style={[b.pillText, { color: b.muted }]}>{workers.length} Workers</Text>
      </View>
    </View>
  );

  const renderWorker = (w: (typeof workers)[number]) => {
    const wsc = w.status === "completed" ? b.fg : w.status === "failed" ? b.dangerBg : b.muted;
    return (
      <View key={w.id} style={[b.surface, { padding: 10, marginBottom: 6 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={[b.mono, { flex: 1, fontWeight: "900", color: b.fg }]}>{w.workerAgentName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {w.status === "running" ? <Loader color={wsc} size={12} /> : w.status === "completed" ? <CheckCircle2 color={wsc} size={12} /> : w.status === "failed" ? <XCircle color={wsc} size={12} /> : null}
            <Text style={[b.pillText, { color: wsc }]}>{w.status}</Text>
          </View>
        </View>
        <Text style={[b.bodyMuted, { marginTop: 4, fontSize: 11 }]}>{w.subtask}</Text>
        {w.errorMessage ? <Text style={{ marginTop: 4, fontFamily: "monospace", fontSize: 11, color: b.dangerBg }}>{w.errorMessage}</Text> : null}
        {w.result ? <Text numberOfLines={isTablet ? 12 : 6} style={{ marginTop: 4, fontFamily: "monospace", fontSize: 11, lineHeight: 16, color: b.fg }}>{w.result}{w.result.length > 600 ? "…" : ""}</Text> : null}
      </View>
    );
  };

  const summaryCard = run.summary ? (
    <View style={[b.surface, { padding: 12, marginTop: 12, backgroundColor: b.accent, borderColor: b.border }]}>
      <Text style={[b.h3, { color: b.accentFg }]}>Summary</Text>
      <Text style={{ marginTop: 4, fontFamily: "monospace", fontSize: 13, lineHeight: 18, color: b.accentFg }}>{run.summary}</Text>
    </View>
  ) : null;

  if (isTablet && run.summary) {
    return (
      <BrutalistContainer header={header} pad={false}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1, borderRightWidth: 2, borderRightColor: b.border, padding: 16 }}>
            {taskCard}<Text style={[b.h3, { marginBottom: 8 }]}>Workers</Text><ScrollView showsVerticalScrollIndicator={false}>{workers.map(renderWorker)}</ScrollView>
          </View>
          <View style={{ width: 420, padding: 16 }}>
            <Text style={[b.h3, { marginBottom: 8 }]}>Summary</Text>
            <ScrollView showsVerticalScrollIndicator={false}><Text style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 18, color: b.fg }}>{run.summary}</Text></ScrollView>
          </View>
        </View>
      </BrutalistContainer>
    );
  }
  return (
    <BrutalistContainer header={header}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {taskCard}<Text style={[b.h3, { marginBottom: 8 }]}>Workers</Text>{workers.map(renderWorker)}{summaryCard}
      </ScrollView>
    </BrutalistContainer>
  );
}

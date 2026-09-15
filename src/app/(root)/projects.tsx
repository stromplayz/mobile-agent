import { useRouter } from "expo-router";
import { Folder, FolderPlus, FolderTree, Pencil, Trash2, Plus, ArrowLeft, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BrutalistContainer } from "@/components/brutalist/container";
import { useBrutalist } from "@/hooks/use-brutalist";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useFeatureStore } from "@/providers/feature-store";
import { PROJECT_COLORS, flattenTree } from "@/modules/projects/defaults";
import { buildProjectTree } from "@/modules/projects/resolver";
import type { Project } from "@/core/types/app-state";

type ProjectRow = Project & { depth: number };

export default function ProjectsScreen() {
  const b = useBrutalist();
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const { projects, createProject, updateProject, deleteProject, pickFolderForProject, hydrating } = useFeatureStore();
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState<{ parentId: string | null; name: string; description: string } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const tree = useMemo(() => buildProjectTree(projects), [projects]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const startCreate = useCallback((parentId: string | null) => { setCreating({ parentId, name: "", description: "" }); }, []);
  const submitCreate = useCallback(async () => { if (!creating || !creating.name.trim()) return; setBusy(true); try { await createProject({ parentId: creating.parentId, name: creating.name.trim(), description: creating.description.trim() || null }); setCreating(null); } finally { setBusy(false); } }, [creating, createProject]);
  const submitFolderPick = useCallback(async () => { if (!pickerTarget) return; setBusy(true); try { await pickFolderForProject(pickerTarget.id); setPickerTarget(null); } finally { setBusy(false); } }, [pickerTarget, pickFolderForProject]);

  const header = (<><FolderTree color={b.fg} size={20} /><Text style={[b.h2, { flex: 1 }]}>Projects</Text><Pressable onPress={() => startCreate(null)} style={({ pressed }) => [b.buttonPrimary, { flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 }]}><FolderPlus color={b.accentFg} size={14} /><Text style={b.buttonPrimaryText}>New</Text></Pressable></>);

  const renderProjectRow = ({ item }: { item: ProjectRow }) => {
    const color = item.color ?? PROJECT_COLORS[item.depth % PROJECT_COLORS.length]!;
    const indent = item.depth * 16;
    return (
      <View style={{ paddingLeft: indent + 12, paddingRight: 12, paddingVertical: 8 }}>
        <View style={[b.surface, { padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <View style={{ width: 14, height: 14, backgroundColor: color }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {item.depth > 0 ? <ArrowLeft color={b.muted} size={10} /> : null}
              <Text numberOfLines={1} style={[b.mono, { fontWeight: "900", color: b.fg }]}>{item.name}</Text>
            </View>
            <Text numberOfLines={1} style={[b.bodyMuted, { fontSize: 11 }]}>{item.folderDisplayName ?? item.folderUri ?? "No folder bound"}{item.description ? ` · ${item.description}` : ""}</Text>
          </View>
          <Pressable hitSlop={6} onPress={() => setPickerTarget(item)}><Folder color={b.fg} size={14} /></Pressable>
          <Pressable hitSlop={6} onPress={() => startCreate(item.id)}><Plus color={b.fg} size={14} /></Pressable>
          <Pressable hitSlop={6} onPress={() => setEditing(item)}><Pencil color={b.fg} size={14} /></Pressable>
          <Pressable hitSlop={6} onPress={() => deleteProject(item.id)}><Trash2 color={b.dangerBg} size={14} /></Pressable>
        </View>
      </View>
    );
  };

  return (
    <BrutalistContainer header={header}>
      <View style={[b.surface, { padding: 12, marginBottom: 12 }]}>
        <Text style={b.label}>How projects work</Text>
        <Text style={[b.body, { marginTop: 6 }]}>Bind a folder once per project. Every chat inside it reuses that folder, model, and agent automatically. Sub-projects inherit from their parent unless you override.</Text>
      </View>
      <FlatList data={flat} keyExtractor={(item) => item.id} renderItem={renderProjectRow} ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        ListEmptyComponent={hydrating ? (<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 }}><ActivityIndicator color={b.muted} size="small" /><Text style={b.bodyMuted}>Loading projects…</Text></View>) : (<View style={{ alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 48 }}><Folder color={b.muted} size={40} /><Text style={b.bodyMuted}>No projects yet. Tap "New" to bind your first folder.</Text></View>)}
        contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} style={isTablet ? { maxWidth: 720, alignSelf: "center", width: "100%" } : undefined} />
      <BrutalistModal open={creating !== null} onClose={() => !busy && setCreating(null)} title={creating?.parentId ? "New Sub-Project" : "New Project"} description={creating?.parentId ? "Sub-projects inherit their parent's folder, model, and agent by default." : "Pick a folder for this project later, or skip."}>
        <TextInput autoFocus style={[b.input, { marginBottom: 8 }]} placeholder="Project name" placeholderTextColor={b.muted} value={creating?.name ?? ""} onChangeText={(v) => setCreating((c) => (c ? { ...c, name: v } : c))} returnKeyType="next" />
        <TextInput style={[b.input, { minHeight: 60 }]} placeholder="Description (optional)" placeholderTextColor={b.muted} value={creating?.description ?? ""} onChangeText={(v) => setCreating((c) => (c ? { ...c, description: v } : c))} multiline numberOfLines={2} textAlignVertical="top" />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable onPress={() => setCreating(null)} disabled={busy} style={[b.buttonGhost, { flex: 1, opacity: busy ? 0.5 : 1 }]}><Text style={b.buttonGhostText}>Cancel</Text></Pressable>
          <Pressable onPress={submitCreate} disabled={busy || !creating?.name.trim()} style={[b.buttonPrimary, { flex: 1, opacity: busy || !creating?.name.trim() ? 0.5 : 1 }]}><Text style={b.buttonPrimaryText}>{busy ? "..." : "Create"}</Text></Pressable>
        </View>
      </BrutalistModal>
      <BrutalistModal open={pickerTarget !== null} onClose={() => !busy && setPickerTarget(null)} title={`Bind folder to "${pickerTarget?.name ?? ""}"`} description="Opens Android's folder picker. The selected folder is saved and reused for every chat.">
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable onPress={() => setPickerTarget(null)} disabled={busy} style={[b.buttonGhost, { flex: 1, opacity: busy ? 0.5 : 1 }]}><Text style={b.buttonGhostText}>Cancel</Text></Pressable>
          <Pressable onPress={submitFolderPick} disabled={busy} style={[b.buttonPrimary, { flex: 1, opacity: busy ? 0.5 : 1 }]}><Text style={b.buttonPrimaryText}>{busy ? "..." : "Pick Folder"}</Text></Pressable>
        </View>
      </BrutalistModal>
      <BrutalistModal open={editing !== null} onClose={() => !busy && setEditing(null)} title="Edit Project" description="Update the project's name or description.">
        <TextInput autoFocus style={[b.input, { marginBottom: 8 }]} placeholder="Project name" placeholderTextColor={b.muted} value={editing?.name ?? ""} onChangeText={(v) => setEditing((e) => (e ? { ...e, name: v } : e))} />
        <TextInput style={[b.input, { minHeight: 60 }]} placeholder="Description" placeholderTextColor={b.muted} value={editing?.description ?? ""} onChangeText={(v) => setEditing((e) => (e ? { ...e, description: v } : e))} multiline numberOfLines={2} textAlignVertical="top" />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable onPress={() => setEditing(null)} disabled={busy} style={[b.buttonGhost, { flex: 1, opacity: busy ? 0.5 : 1 }]}><Text style={b.buttonGhostText}>Cancel</Text></Pressable>
          <Pressable onPress={async () => { if (!editing) return; setBusy(true); try { await updateProject(editing.id, { name: editing.name, description: editing.description }); setEditing(null); } finally { setBusy(false); } }} disabled={busy} style={[b.buttonPrimary, { flex: 1, opacity: busy ? 0.5 : 1 }]}><Text style={b.buttonPrimaryText}>{busy ? "..." : "Save"}</Text></Pressable>
        </View>
      </BrutalistModal>
    </BrutalistContainer>
  );
}

function BrutalistModal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children?: React.ReactNode; }) {
  const b = useBrutalist();
  if (!open) return null;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: b.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.5)", zIndex: 100, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={[b.surface, { width: "100%", maxWidth: 480, padding: 16, shadowColor: b.fg, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6, backgroundColor: b.bg }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={b.h3}>{title}</Text>
          <Pressable hitSlop={8} onPress={onClose}><X color={b.fg} size={16} /></Pressable>
        </View>
        {description ? <Text style={[b.bodyMuted, { marginBottom: 12 }]}>{description}</Text> : null}
        {children}
      </View>
    </View>
  );
}

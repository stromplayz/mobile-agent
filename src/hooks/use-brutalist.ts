import { useTheme } from "@/hooks/use-theme";

export function useBrutalist() {
  const theme = useTheme();
  const isDark = theme.background === "#000000" || theme.text === "#ffffff";
  const bg = isDark ? "#000000" : "#FFFFFF";
  const fg = isDark ? "#FFFFFF" : "#000000";
  const muted = isDark ? "#8A8A8A" : "#666666";
  const accent = isDark ? "#FFFFFF" : "#000000";
  const accentFg = isDark ? "#000000" : "#FFFFFF";
  const border = fg;
  const dangerBg = "#DC2626";
  const dangerFg = "#FFFFFF";
  return {
    bg, fg, muted, accent, accentFg, border, dangerBg, dangerFg, isDark,
    surface: { backgroundColor: bg, borderWidth: 2, borderColor: border, borderRadius: 0 } as const,
    surfaceMuted: { backgroundColor: isDark ? "#0A0A0A" : "#F5F5F5", borderWidth: 2, borderColor: border, borderRadius: 0 } as const,
    shadowHard: { shadowColor: fg, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as const,
    h2: { fontFamily: "monospace", fontWeight: "900", fontSize: 20, lineHeight: 24, letterSpacing: -0.3, color: fg, textTransform: "uppercase" as const } as const,
    h3: { fontFamily: "monospace", fontWeight: "700", fontSize: 15, lineHeight: 20, letterSpacing: 0.2, color: fg, textTransform: "uppercase" as const } as const,
    label: { fontFamily: "monospace", fontWeight: "700", fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: muted, textTransform: "uppercase" as const } as const,
    body: { fontFamily: "monospace", fontWeight: "400", fontSize: 14, lineHeight: 20, color: fg } as const,
    bodyMuted: { fontFamily: "monospace", fontWeight: "400", fontSize: 13, lineHeight: 18, color: muted } as const,
    mono: { fontFamily: "monospace", fontWeight: "500", fontSize: 13, lineHeight: 18, color: fg } as const,
    buttonPrimary: { backgroundColor: accent, borderWidth: 2, borderColor: border, borderRadius: 0, paddingHorizontal: 16, paddingVertical: 10 } as const,
    buttonPrimaryText: { fontFamily: "monospace", fontWeight: "900", fontSize: 13, letterSpacing: 0.8, color: accentFg, textTransform: "uppercase" as const } as const,
    buttonGhost: { backgroundColor: "transparent", borderWidth: 2, borderColor: border, borderRadius: 0, paddingHorizontal: 16, paddingVertical: 10 } as const,
    buttonGhostText: { fontFamily: "monospace", fontWeight: "700", fontSize: 13, letterSpacing: 0.8, color: fg, textTransform: "uppercase" as const } as const,
    input: { backgroundColor: bg, borderWidth: 2, borderColor: border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "monospace", fontSize: 14, color: fg } as const,
    pill: { borderWidth: 2, borderColor: border, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 2 } as const,
    pillText: { fontFamily: "monospace", fontWeight: "700", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" as const, color: fg } as const,
    card: { backgroundColor: bg, borderWidth: 2, borderColor: border, borderRadius: 0, padding: 12 } as const,
    cardWithShadow: { backgroundColor: bg, borderWidth: 2, borderColor: border, borderRadius: 0, padding: 12, shadowColor: fg, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as const,
  };
}
export type BrutalistTokens = ReturnType<typeof useBrutalist>;

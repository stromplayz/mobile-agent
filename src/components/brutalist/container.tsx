import type { PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBrutalist } from "@/hooks/use-brutalist";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type BrutalistContainerProps = PropsWithChildren<{ header?: ReactNode; sidebar?: ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean; }>;

export function BrutalistContainer({ children, header, sidebar, style, pad = true }: BrutalistContainerProps) {
  const b = useBrutalist();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const contentMaxWidth = isDesktop ? 1280 : isTablet ? 960 : 9999;
  return (
    <SafeAreaView edges={["top", "right", "bottom", "left"]} style={{ flex: 1, backgroundColor: b.bg }}>
      {header ? (
        <View style={{ backgroundColor: b.bg, borderBottomWidth: 2, borderBottomColor: b.border }}>
          <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
            {header}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1, flexDirection: isTablet && sidebar ? "row" : "column", width: "100%", maxWidth: sidebar ? undefined : contentMaxWidth, alignSelf: "center" }}>
        <View style={[{ flex: 1, padding: pad ? 16 : 0 }, style]}>{children}</View>
        {sidebar ? <View style={{ width: isDesktop ? 360 : 320, borderLeftWidth: 2, borderLeftColor: b.border, backgroundColor: b.bg, padding: 16 }}>{sidebar}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function BrutalistMasterDetail({ master, detail, masterWidth }: { master: ReactNode; detail?: ReactNode; masterWidth?: number }) {
  const b = useBrutalist();
  const { isTablet } = useResponsiveLayout();
  if (!isTablet) return <View style={{ flex: 1 }}>{master}</View>;
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: masterWidth ?? 360, borderRightWidth: 2, borderRightColor: b.border, backgroundColor: b.bg }}>{master}</View>
      <View style={{ flex: 1, backgroundColor: b.bg }}>{detail}</View>
    </View>
  );
}

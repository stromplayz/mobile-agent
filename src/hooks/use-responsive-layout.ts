import { Platform, useWindowDimensions } from "react-native";
export const TABLET_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1100;
export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  return { width, isTablet: width >= TABLET_BREAKPOINT, isDesktop: width >= DESKTOP_BREAKPOINT, isPhone: width < TABLET_BREAKPOINT };
}
export function isWeb() { return Platform.OS === "web"; }
export function isAndroid() { return Platform.OS === "android"; }

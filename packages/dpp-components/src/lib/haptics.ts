import { useWebHaptics } from "web-haptics/react";

export function useHapticTap() {
  const { trigger } = useWebHaptics();
  return trigger;
}

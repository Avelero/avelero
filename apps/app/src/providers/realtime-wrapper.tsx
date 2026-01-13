"use client";

import { RealtimeProvider } from "./realtime-provider";

export function RealtimeWrapper({ children }: { children: React.ReactNode }) {
    return <RealtimeProvider>{children}</RealtimeProvider>;
}

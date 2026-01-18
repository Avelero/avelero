import { MainSkeleton } from "@/components/main-skeleton";
import { Suspense } from "react";

export default function ThemeEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<MainSkeleton />}>{children}</Suspense>;
}

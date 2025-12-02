import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeEditorLoader } from "@/components/theme-editor/theme-editor-loader";
import { MainSkeleton } from "@/components/main-skeleton";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Theme Editor | Avelero",
};

export default function ThemeEditorPage() {
  return (
    <Suspense fallback={<MainSkeleton />}>
      <ThemeEditorLoader />
    </Suspense>
  );
}

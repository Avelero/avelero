import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design | Avelero",
};

export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/design">Content</ControlBarNavButton>
          <ControlBarNavButton href="/design/theme">
            Theme
          </ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight />
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start overflow-y-hidden scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

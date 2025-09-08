import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Avelero",
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/settings">General</ControlBarNavButton>
          <ControlBarNavButton href="/settings/members">
            Members
          </ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight />
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-12 overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

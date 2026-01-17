"use client";

import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { usePathname } from "next/navigation";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // General tab should only be active for /settings exactly, not nested routes
  const isGeneralActive = pathname === "/settings";

  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/settings" isActive={isGeneralActive}>
            General
          </ControlBarNavButton>
          <ControlBarNavButton href="/settings/members">
            Members
          </ControlBarNavButton>
          <ControlBarNavButton href="/settings/integrations">
            Integrations
          </ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight />
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-8 overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

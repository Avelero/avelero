import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { Button } from "@v1/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

/**
 * Page layout that provides the Passports list UI shell with a control bar and centered content area.
 *
 * @param children - Content rendered inside the layout's scrollable main area
 * @returns The layout element containing the control bar (with navigation and Create button) and the content container
 */
export default function PassportsListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/passports">Passports</ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight>
          <Button variant="default" asChild>
            <Link href="/passports/create"> <span className="px-1">Create</span></Link>
          </Button>
        </ControlBarRight>
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-6 overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}
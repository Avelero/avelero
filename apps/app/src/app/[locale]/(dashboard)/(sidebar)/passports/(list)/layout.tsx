import {
  ControlBar,
  ControlBarLeft,
  ControlBarNavButton,
  ControlBarRight,
} from "@/components/control-bar";
import { PassportsUploadSheet } from "@/components/passports/upload-sheet";
import { Button } from "@v1/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

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
          <PassportsUploadSheet />
          <Button
            variant="default"
            size="default"
            asChild
            className="min-w-[100px]"
          >
            <Link href="/passports/create">
              <span className="px-1">Create</span>
            </Link>
          </Button>
        </ControlBarRight>
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-6 overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

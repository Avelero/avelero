import {
    ControlBar,
    ControlBarLeft,
    ControlBarRight,
  } from "@/components/control-bar";
  import { Button } from "@v1/ui/button";
  import type { Metadata } from "next";
  
  export const metadata: Metadata = {
    title: "Passports | Avelero",
  };
  
  export default function PassportsFormLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="flex flex-col h-full">
        <ControlBar>
          <ControlBarLeft />
          <ControlBarRight>
            <Button variant="outline">Cancel</Button>
            <Button variant="brand">Save</Button>
          </ControlBarRight>
        </ControlBar>
        <div className="flex w-full h-full justify-center items-start p-12 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    );
  }
  
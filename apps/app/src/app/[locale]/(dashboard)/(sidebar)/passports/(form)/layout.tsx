import {
  ControlBar,
  ControlBarLeft,
  ControlBarRight,
} from "@/components/control-bar";
import { PassportFormActions } from "@/components/passports/form-actions";
import { PassportFormProvider } from "@/contexts/passport-form-context";
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
    <PassportFormProvider>
      <div className="flex flex-col h-full">
        <ControlBar>
          <ControlBarLeft />
          <ControlBarRight>
            <PassportFormActions />
          </ControlBarRight>
        </ControlBar>
        <div className="flex w-full h-full justify-center items-start p-12 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </PassportFormProvider>
  );
}

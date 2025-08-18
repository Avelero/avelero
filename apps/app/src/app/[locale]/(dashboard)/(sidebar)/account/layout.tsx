import {
  ControlBar,
  ControlBarLeft,
  ControlBarRight,
  ControlBarNavButton,
} from "@/components/control-bar";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ControlBar>
        <ControlBarLeft>
          <ControlBarNavButton href="/account" isActive>
            General
          </ControlBarNavButton>
          <ControlBarNavButton href="/account/brands">
            Brands
          </ControlBarNavButton>
        </ControlBarLeft>
        <ControlBarRight />
      </ControlBar>
      <div className="flex w-full h-full justify-center items-start p-12 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

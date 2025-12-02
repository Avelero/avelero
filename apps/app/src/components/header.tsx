import { NavigationLabel } from "@/components/navigation-label";
import { UserMenu } from "@/components/user-menu";
import { Icons } from "@v1/ui/icons";
import Image from "next/image";
import Link from "next/link";
import LogoIcon from "public/LogoIcon256.svg";

interface HeaderProps {
  hideUserMenu?: boolean;
  disableLogoLink?: boolean;
  variant?: "default" | "editor";
}

export function Header({ hideUserMenu, disableLogoLink, variant = "default" }: HeaderProps) {
  const logoIsLink = !disableLogoLink;
  const isEditor = variant === "editor";

  return (
    <header
      className="sticky top-0 z-50 border-b bg-background"
      style={{ height: "56px" }}
    >
      <div className="flex h-full">
        {/* Logo Section / Back Button */}
        {isEditor ? (
          <Link
            href="/design"
            className="flex shrink-0 items-center justify-center border-r hover:bg-accent transition-colors focus-visible:outline-none"
            style={{ width: "56px", height: "56px" }}
            prefetch
          >
            <Icons.ChevronLeft className="h-5 w-5" />
          </Link>
        ) : logoIsLink ? (
          <Link
            href="/"
            className="flex shrink-0 items-center border-r focus-visible:outline-none"
            style={{ width: "56px", height: "56px" }}
            prefetch
          >
            <Image
              src={LogoIcon}
              alt="logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain mx-auto"
            />
          </Link>
        ) : (
          <div
            className="flex shrink-0 items-center border-r select-none"
            style={{ width: "56px", height: "56px" }}
          >
            <Image
              src={LogoIcon}
              alt="logo"
              width={24}
              height={24}
              className="h-6 w-6 object-contain mx-auto"
            />
          </div>
        )}

        {/* Navigation Section */}
        <div className="flex min-w-0 flex-1 items-center justify-between px-4">
          {isEditor ? (
            <EditorHeaderStatus />
          ) : (
            <NavigationLabel />
          )}
          <div className="flex items-center gap-2">
            {!hideUserMenu && <UserMenu />}
          </div>
        </div>
      </div>
    </header>
  );
}

function EditorHeaderStatus() {
  return (
    <div className="flex items-center gap-3">
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-success/10 rounded-full">
        <div className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-xs font-medium text-success">Live</span>
      </div>
    </div>
  );
}

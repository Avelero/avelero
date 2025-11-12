import { NavigationLabel } from "@/components/navigation-label";
import { UserMenu } from "@/components/user-menu";
import Image from "next/image";
import Link from "next/link";
import LogoIcon from "public/LogoIcon256.svg";

interface HeaderProps {
  hideUserMenu?: boolean;
  disableLogoLink?: boolean;
}

export function Header({ hideUserMenu, disableLogoLink }: HeaderProps) {
  const logoIsLink = !disableLogoLink;

  return (
    <header
      className="sticky top-0 z-50 border-b bg-background"
      style={{ height: "56px" }}
    >
      <div className="flex h-full">
        {/* Logo Section */}
        {logoIsLink ? (
          <Link
            href="/"
            className="flex shrink-0 items-center border-r focus-visible:outline-none"
            style={{ width: "56px", height: "56px" }}
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
        <div className="flex min-w-0 flex-1 items-center justify-between px-6">
          <NavigationLabel />
          <div className="flex items-center gap-2">
            {!hideUserMenu && <UserMenu />}
          </div>
        </div>
      </div>
    </header>
  );
}

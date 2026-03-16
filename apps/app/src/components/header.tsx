/**
 * App header shell.
 *
 * Renders the primary chrome for the main app and the theme editor.
 */
import { AnimatedAveleroIcon } from "@/components/animated-avelero-icon";
import { HeaderNavigation } from "@/components/header-navigation";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { DataControl } from "@/components/theme-editor/data-control";
import { UserMenu } from "@/components/user-menu";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";

interface HeaderProps {
  hideUserMenu?: boolean;
  disableLogoLink?: boolean;
  disableNotifications?: boolean;
  variant?: "default" | "editor";
}

export function Header({
  hideUserMenu,
  disableLogoLink,
  disableNotifications = false,
  variant = "default",
}: HeaderProps) {
  // Switch the leading chrome depending on whether the editor is active.
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
            href="/theme"
            className="flex shrink-0 items-center justify-center border-r border-b bg-background hover:bg-accent transition-colors focus-visible:outline-none"
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
            aria-label="Home"
            prefetch
          >
            <AnimatedAveleroIcon size={28} className="mx-auto h-14 w-14" />
          </Link>
        ) : (
          <div
            className="flex shrink-0 items-center border-r select-none"
            style={{ width: "56px", height: "56px" }}
            role="img"
            aria-label="Avelero"
          >
            <AnimatedAveleroIcon size={28} className="mx-auto h-14 w-14" />
          </div>
        )}

        {/* Navigation Section */}
        <div className="flex min-w-0 flex-1 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <HeaderNavigation />
          </div>
          <div className="flex items-center gap-4">
            {isEditor && <DataControl />}
            {!hideUserMenu && (
              <>
                <NotificationCenter disabled={disableNotifications} />
                <UserMenu />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { UserMenu } from "@/components/user-menu";
import { NavigationLabel } from "@/components/navigation-label";

interface HeaderProps {
  pathname: string;
  locale: string;
}

export function Header({ pathname, locale }: HeaderProps) {
  return (
    <header className="md:m-0 z-50 px-6 md:border-b h-[70px] flex justify-between items-center desktop:sticky desktop:top-0 desktop:bg-background sticky md:static top-0 backdrop-filter backdrop-blur-xl md:backdrop-filter md:backdrop-blur-none dark:bg-[#121212] bg-[#fff] bg-opacity-70 desktop:rounded-t-[10px]">
      <NavigationLabel pathname={pathname} locale={locale} />

      <div className="flex space-x-2 ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
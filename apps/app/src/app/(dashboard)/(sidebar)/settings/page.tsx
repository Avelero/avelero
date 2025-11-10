import { DeleteBrand } from "@/components/settings/delete-brand";
import { SetCountry } from "@/components/settings/set-country";
import { SetEmail } from "@/components/settings/set-email";
import { SetLogo } from "@/components/settings/set-logo";
import { SetName } from "@/components/settings/set-name";

export default function SettingsPage() {
  // No prefetching needed - user and brand data already prefetched in layout
  // Following Midday's simple page pattern
  return (
    <div className="w-[700px]">
      <div className="flex flex-col gap-12">
        <SetLogo />
        <SetName />
        <SetEmail />
        <SetCountry />
        <DeleteBrand />
      </div>
    </div>
  );
}

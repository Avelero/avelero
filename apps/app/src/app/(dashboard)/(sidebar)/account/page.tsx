import { DeleteAccount } from "@/components/account/delete-account";
import { SetAvatar } from "@/components/account/set-avatar";
import { SetEmail } from "@/components/account/set-email";
import { SetName } from "@/components/account/set-name";

export default function AccountPage() {
  // No prefetching needed - user data is already prefetched in layout
  // Following Midday's simple page pattern
  return (
    <div className="w-[700px]">
      <div className="flex flex-col gap-12">
        <SetAvatar />
        <SetName />
        <SetEmail />
        <DeleteAccount />
      </div>
    </div>
  );
}

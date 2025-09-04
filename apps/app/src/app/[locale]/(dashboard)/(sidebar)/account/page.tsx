import { DeleteAccount } from "@/components/delete-account";
import { SetAvatar } from "@/components/set-avatar";
import { SetEmail } from "@/components/set-email";
import { SetName } from "@/components/set-name";

export default function AccountPage() {
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

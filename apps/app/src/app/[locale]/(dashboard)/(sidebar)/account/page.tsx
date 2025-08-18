import { SetAvatar } from "@/components/set-avatar";
import { SetEmail } from "@/components/set-email";
import { SetName } from "@/components/set-name";
import { DeleteAccount } from "@/components/delete-account";

export default function AccountPage() {
  return (
    <div className="w-[700px]">
        <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-4">
                <SetAvatar />
                <SetName />
                <SetEmail />
            </div>
            <DeleteAccount />
        </div>
    </div>
  );
}

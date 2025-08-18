import { Button } from "@v1/ui/button";

function DeleteAccount() {
    return (
      <div className="flex flex-row p-6 border border-destructive justify-between items-center">
        <div className="flex flex-col gap-2">
            <h6 className="text-foreground">Delete Account</h6>
            <p className="text-secondary">Permanently delete your account.</p>
        </div>
        <Button variant="destructive">Delete Account</Button>
      </div>
    );
  }
  
export { DeleteAccount };
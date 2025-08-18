"use client";

import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";

function SetEmail() {

  return (
    <div className="relative">
        <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
            <h6 className="text-foreground">Email</h6>
            <p className="text-secondary">Enter your email address on the right.</p>
        </div>
        <Input 
            type="email"
            placeholder="Email" 
        />
        </div>
            <div className="flex flex-row justify-end border-x border-b p-6">
            <Button variant="default">Save</Button>
        </div>
    </div>
  );
}
  
export { SetEmail };
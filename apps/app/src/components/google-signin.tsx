"use client";

import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { useState } from "react";

export function GoogleSignin() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSignin = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
    } catch (error) {
      console.error("Google signin error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSignin} 
      variant="outline" 
      className="w-full font-mono"
      disabled={isLoading}
    >
      {isLoading ? "Connecting..." : "Continue with Google"}
    </Button>
  );
}

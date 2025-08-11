"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useState } from "react";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

interface EmailSigninProps {
  onEmailSubmit: (email: string) => void;
  isLoading?: boolean;
}

export function EmailSignin({ onEmailSubmit, isLoading = false }: EmailSigninProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0]?.message || "Invalid email");
      return;
    }

    onEmailSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="font-mono"
          autoComplete="email"
        />
        {error && (
          <p className="text-sm text-destructive font-mono">{error}</p>
        )}
      </div>
      <Button 
        type="submit" 
        className="w-full font-mono" 
        disabled={isLoading || !email}
      >
        {isLoading ? "Sending..." : "Continue with Email"}
      </Button>
    </form>
  );
}
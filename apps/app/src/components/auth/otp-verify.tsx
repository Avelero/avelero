"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useState, useRef, useEffect } from "react";

interface OtpVerifyProps {
  email: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  onOtpSubmit: (otp: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/ban-types  
  onBack: () => void;
  // eslint-disable-next-line @typescript-eslint/ban-types
  onResend: () => Promise<void>;
  isLoading?: boolean;
  isResending?: boolean;
  error?: string;
}

export function OtpVerify({ 
  email, 
  onOtpSubmit, 
  onBack,
  onResend, 
  isLoading = false,
  isResending = false, 
  error 
}: OtpVerifyProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleResend = async () => {
    // Clear OTP input when resending
    setOtp(["", "", "", "", "", ""]);
    await onResend();
    // Refocus first input after resend
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  };

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple characters
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== "") && !isLoading) {
      onOtpSubmit(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split("").concat(Array(6).fill("")).slice(0, 6);
      setOtp(newOtp);
      if (newOtp.every(digit => digit !== "")) {
        onOtpSubmit(newOtp.join(""));
      }
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground font-mono">
          We sent a 6-digit code to {email}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          Code expires in 10 minutes
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className="flex-1 h-10 text-center font-mono"
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive font-mono text-center">{error}</p>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isLoading || isResending}
              className="flex-1 font-mono"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onOtpSubmit(otp.join(""))}
              disabled={isLoading || isResending || otp.some(digit => !digit)}
              className="flex-1 font-mono"
            >
              {isLoading ? "Verifying..." : "Continue"}
            </Button>
          </div>
          
          <Button
            type="button"
            variant="ghost"
            onClick={handleResend}
            disabled={isLoading || isResending}
            className="w-full font-mono text-xs"
          >
            {isResending ? "Sending..." : "Resend code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
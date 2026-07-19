"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PhoneVerificationDialogProps {
  customer: {
    id: number;
    name: string;
    phone_masked: string;
    phone_last_two: string;
  };
  onVerify: (phone: string) => Promise<void>;
  onCancel: () => void;
}

export function PhoneVerificationDialog({
  customer,
  onVerify,
  onCancel,
}: PhoneVerificationDialogProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    // Extract only digits
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Please enter a valid phone number (at least 10 digits)");
      return;
    }

    setLoading(true);
    try {
      await onVerify(phoneDigits);
      toast.success("Phone verified successfully");
    } catch (err) {
      let errorMessage = "Phone verification failed";

      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes("does not match")) {
          errorMessage = "The phone number doesn't match our records. Please check and try again.";
        } else if (message.includes("not found")) {
          errorMessage = "Customer not found. Please go back and try a different name.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 border-green-200 shadow-lg shadow-green-100">
        <h2 className="text-2xl font-bold mb-2 text-green-700">Verify Phone Number</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          We have you registered as <span className="font-semibold">{customer.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Phone Number (last 2 digits: {customer.phone_last_two})
            </label>
            <Input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(null);
              }}
              disabled={loading}
              autoFocus
              className="text-lg"
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </form>

        <p className="text-xs text-slate-500 dark:text-slate-500 mt-6 text-center">
          Your phone number is only used to verify your identity
        </p>
      </Card>
    </div>
  );
}

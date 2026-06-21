"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        className="absolute right-0 top-0 size-8 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        <span className="sr-only">{show ? "Hide password" : "Show password"}</span>
      </Button>
    </div>
  );
}

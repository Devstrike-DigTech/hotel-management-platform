import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignIn } from "@/components/auth/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense fallback={null}>
        <SignIn />
      </Suspense>
    </AuthFrame>
  );
}

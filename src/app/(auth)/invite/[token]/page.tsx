import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { InviteAccept } from "@/components/auth/invite";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthFrame>
      <Suspense fallback={null}>
        <InviteAccept token={token} />
      </Suspense>
    </AuthFrame>
  );
}

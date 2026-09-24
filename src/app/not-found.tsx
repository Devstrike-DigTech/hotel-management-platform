import Link from "next/link";
import { AdireGlyph } from "@/components/motifs/adire";
import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="relative z-[1] flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Wordmark size="sm" />
      <AdireGlyph kind="eye" size={72} className="mt-12 text-adire" />
      <p className="eyebrow mt-6">Error 404</p>
      <h1 className="display mt-3 text-[40px] leading-tight text-ink">
        Nothing <em>at this address</em>.
      </h1>
      <p className="mt-3 max-w-sm text-[14.5px] text-ink-muted">The page may have moved, or the link was mistyped.</p>
      <Link href="/" className="mt-8 inline-flex h-10 items-center rounded-md bg-adire px-5 text-[14px] font-medium text-adire-ink hover:bg-adire-hover">
        Back to the overview
      </Link>
    </main>
  );
}

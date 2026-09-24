import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { config } from "@/lib/config";
import { Wordmark } from "@/components/brand";
import { AdireField } from "@/components/motifs/adire";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { EnvChip } from "@/components/shell/env-chip";

/**
 * The sign-in frame: a night panel of adire cloth on the left (hidden on
 * phones), the form on paper on the right.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-night text-night-ink lg:flex lg:flex-col">
        <AdireField cols={14} rows={18} className="absolute inset-0 h-full w-full text-night-adire opacity-[0.13]" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_110%,rgb(12_16_25/0.1),rgb(12_16_25/0.92)_62%)]" />
        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Wordmark tone="night" size="md" />
          <div className="max-w-[34rem]">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-night-brass">{config.company} &middot; Internal</p>
            <p className="display mt-5 text-[46px] leading-[1.04] text-night-ink xl:text-[52px]">
              Every hotel on the platform, <em className="text-night-brass">in one instrument</em>.
            </p>
            <p className="mt-6 max-w-md text-[14.5px] leading-relaxed text-night-muted">
              Revenue, tenants, support and the machinery underneath. Changes made here reach live hotels immediately.
            </p>
          </div>
          <ul className="grid max-w-lg grid-cols-3 gap-6 border-t border-night-line pt-6 text-[12px] text-night-muted">
            <li>
              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-night-adire">Two factors</span>
              Password and an authenticator code, every time.
            </li>
            <li>
              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-night-adire">Step-up</span>
              Sensitive actions ask again after ten minutes.
            </li>
            <li>
              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-night-adire">Recorded</span>
              Every action lands in the platform audit log.
            </li>
          </ul>
        </div>
      </aside>
      <main className="relative z-[1] flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-3">
          <span className="lg:hidden">
            <Wordmark size="sm" />
          </span>
          <span className="hidden items-center gap-2 text-[12px] text-ink-muted lg:flex">
            <ShieldCheck size={14} weight="duotone" className="text-adire" /> Restricted to {config.company} staff
          </span>
          <div className="flex items-center gap-2">
            <EnvChip />
            <ThemeToggle compact />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-[11.5px] text-ink-faint">
          Hotel staff sign in at the hotel admin, not here. Access is logged with your IP address and device.
        </p>
      </main>
    </div>
  );
}

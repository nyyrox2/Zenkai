import { Link } from 'react-router-dom'
import { ChevronRight, ExternalLink, MessagesSquare, Sparkles } from 'lucide-react'
import { DISCORD_URL } from '../lib/app'
import { DiscordIcon } from './BrandIcons'
import { BorderBeam } from './BorderBeam'

/** Discord Community Banner displayed on HomePage instead of the setup profile placeholder. */
export function ProfileCard() {
  return (
    <section className="mx-auto max-w-7xl space-y-3 px-4 sm:px-6" aria-label="Discord Community">
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[#5865F2]/30 bg-gradient-to-r from-[#5865F2]/15 via-card/85 to-card/65 p-4 pr-5 transition duration-300 hover:border-[#5865F2]/60 hover:shadow-xl hover:shadow-[#5865F2]/10 active:scale-[0.99] sm:p-5"
      >
        <BorderBeam size={180} duration={8} color="#5865F2" />
        <div className="flex items-center gap-4 min-w-0">
          <div className="grid size-12 sm:size-14 shrink-0 place-items-center rounded-2xl bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/30 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
            <DiscordIcon className="size-6 sm:size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-black tracking-tight text-foreground">
                Join us on Discord!
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#5865F2]/20 px-2 py-0.5 text-[10px] font-bold text-[#5865F2]">
                <Sparkles className="size-2.5" /> Community
              </span>
            </div>
            <p className="truncate text-xs text-muted mt-0.5">
              Chat about anime, request shows, report stream issues &amp; join giveaways with fellow otakus.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#5865F2] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5865F2]/25 transition group-hover:brightness-110">
            <span>Join Server</span>
            <ExternalLink className="size-3.5" />
          </span>
          <span className="sm:hidden grid size-10 place-items-center rounded-full bg-[#5865F2] text-white">
            <ExternalLink className="size-4" />
          </span>
        </div>
      </a>

      <Link
        to="/community"
        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-r from-accent/10 via-card/85 to-card/65 p-4 pr-5 transition duration-300 hover:border-accent/60 hover:shadow-xl hover:shadow-accent/10 active:scale-[0.99] sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3 sm:size-14">
            <MessagesSquare className="size-6 sm:size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-display text-lg font-black tracking-tight text-foreground">
              Zenkai Community
            </span>
            <p className="mt-0.5 truncate text-xs text-muted">
              Post, share recs &amp; chat with other fans right here on Zenkai.
            </p>
          </div>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition group-hover:translate-x-0.5 group-hover:brightness-110">
          <ChevronRight className="size-5" />
        </span>
      </Link>
    </section>
  )
}

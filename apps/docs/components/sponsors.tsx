import { sponsors, formatSponsorLink } from "@/lib/sponsors";
import Link from "next/link";

export function Sponsors() {
  return (
    <div className="flex flex-col gap-2">
      {sponsors.map(sponsor => (
        <Link
          key={sponsor.name}
          href={formatSponsorLink(sponsor.href)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-center rounded-xl bg-fd-secondary/50 px-4 py-6 transition-colors hover:bg-fd-secondary"
        >
          <img
            src={sponsor.logo}
            alt={sponsor.name}
            className={`object-contain max-w-full h-7 ${sponsor.invertDark ? "dark:invert" : ""}`}
          />
        </Link>
      ))}

      <Link
        href="https://github.com/sponsors/libpdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-xs text-fd-muted-foreground hover:text-fd-foreground"
      >
        Become a sponsor
      </Link>
    </div>
  );
}

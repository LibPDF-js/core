export interface Sponsor {
  name: string;
  href: string;
  logo: string;
  /** If true, invert logo colors in dark mode */
  invertDark?: boolean;
}

export const sponsors: Sponsor[] = [
  {
    name: "Documenso",
    href: "https://documenso.com",
    logo: "/sponsors/documenso.png",
    invertDark: true,
  },
];

export function formatSponsorLink(href: string) {
  const url = new URL(href);

  url.searchParams.set("utm_source", "libpdf-docs");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "sponsors");

  return url.toString();
}

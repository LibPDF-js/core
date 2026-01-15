import type { AnchorHTMLAttributes, FC, ReactNode } from "react";

const UTM_PARAMS = {
  utm_source: "libpdf",
  utm_medium: "docs",
};

function isExternalUrl(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

function addUtmParams(href: string): string {
  try {
    const url = new URL(href);

    for (const [key, value] of Object.entries(UTM_PARAMS)) {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  } catch {
    return href;
  }
}

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export function createMdxLink(RelativeLink: FC<AnchorProps>): FC<AnchorProps> {
  return function MdxLink({ href, children, ...props }) {
    if (!href) {
      return <a {...props}>{children}</a>;
    }

    // External links: add UTM params and open in new tab
    if (isExternalUrl(href)) {
      return (
        <a href={addUtmParams(href)} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }

    // Internal links: use the relative link handler from fumadocs
    return (
      <RelativeLink href={href} {...props}>
        {children}
      </RelativeLink>
    );
  };
}

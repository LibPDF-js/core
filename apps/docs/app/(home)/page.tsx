import { formatSponsorLink, sponsors } from "@/lib/sponsors";
import clsx from "clsx";
import { highlight } from "fumadocs-core/highlight";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import {
  ArrowRight,
  Check,
  FileCheck,
  FileSearch,
  FileText,
  Heart,
  Layers,
  Lock,
  Minus,
  Paperclip,
  PenTool,
  Scissors,
  Terminal,
} from "lucide-react";
import Link from "next/link";

import { CopyButton } from "./copy-button";

// Shared padding classes for full-bleed sections
const CONTAINER_PADDING = "px-4 md:px-6";
const BLEED_NEGATIVE_MARGIN = "-mx-4 md:-mx-6";
const BLEED_PADDING = "px-4 md:px-6";

function GridPattern() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                           linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/5 to-transparent rounded-full blur-3xl" />
    </div>
  );
}

function Hero() {
  return (
    <section className={clsx("relative py-24 md:py-40", BLEED_NEGATIVE_MARGIN, BLEED_PADDING)}>
      <GridPattern />
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-xs font-medium tracking-wide uppercase border border-border rounded-full bg-muted/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Now in Beta
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
          The PDF library
          <br />
          <span className="text-muted-foreground">TypeScript deserves</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Parse, modify, sign, and generate PDFs with a modern TypeScript API.
          <br className="hidden md:block" />
          The only library with incremental saves that preserve digital signatures.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href="/docs"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-all"
          >
            Get Started
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://github.com/libpdf-js/core"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/50 transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            View on GitHub
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            TypeScript native
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Minimal dependencies
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Node, Bun & Browser
          </div>
        </div>
      </div>
    </section>
  );
}

function InstallBlock() {
  return (
    <section
      className={clsx(
        "py-12 border-y border-border bg-muted/30",
        BLEED_NEGATIVE_MARGIN,
        BLEED_PADDING,
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          <div className="group flex items-center gap-3 pl-5 pr-3 py-3 rounded-lg bg-background border border-border font-mono text-sm">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground select-none">$</span>
            <code>npm install @libpdf/core</code>
            <CopyButton text="npm install @libpdf/core" />
          </div>
          <span className="text-muted-foreground hidden md:block">or</span>
          <div className="group flex items-center gap-3 pl-5 pr-3 py-3 rounded-lg bg-background border border-border font-mono text-sm">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground select-none">$</span>
            <code>bun add @libpdf/core</code>
            <CopyButton text="bun add @libpdf/core" />
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Layers,
    title: "Incremental Updates",
    description:
      "Append changes without rewriting the entire file. Preserves existing digital signatures.",
  },
  {
    icon: PenTool,
    title: "Digital Signatures",
    description: "PAdES B-B through B-LTA with long-term validation. OCSP and CRL embedding.",
  },
  {
    icon: Lock,
    title: "Encryption",
    description: "AES-256 and RC4 password protection. Decrypt on load, encrypt on save.",
  },
  {
    icon: FileCheck,
    title: "Form Filling",
    description: "Fill and flatten text fields, checkboxes, radio buttons, and dropdowns.",
  },
  {
    icon: FileSearch,
    title: "Text Extraction",
    description: "Extract text content from pages with position and formatting information.",
  },
  {
    icon: Scissors,
    title: "Merge & Split",
    description: "Combine multiple documents, extract page ranges, and embed pages as XObjects.",
  },
  {
    icon: Paperclip,
    title: "Attachments",
    description: "Embed and extract file attachments with full EmbeddedFiles support.",
  },
  {
    icon: FileText,
    title: "Content Drawing",
    description:
      "Draw text and images on pages. TrueType font embedding with automatic subsetting.",
  },
];

function Features() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3">
            Capabilities
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need for PDFs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
          {features.map(feature => (
            <div
              key={feature.title}
              className="p-8 bg-background hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-5">
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2 tracking-tight">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const exampleCode = `import { PDF, P12Signer } from '@libpdf/core';

// Load an encrypted PDF
const pdf = await PDF.load(bytes, { password: 'secret' });

// Fill form fields
const form = pdf.getForm();
form.getTextField('name').setText('Jane Doe');
form.getCheckBox('agree').check();

// Sign with a certificate (returns the signed bytes)
const signer = await P12Signer.create(p12Bytes, 'password');
const { bytes: signed } = await pdf.sign({ signer });`;

async function CodeExample() {
  const highlighted = await highlight(exampleCode, {
    lang: "typescript",
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    components: {
      pre: props => (
        <CodeBlock className="my-0 border-0 rounded-none">
          <Pre className="p-6 max-h-none wrap">{props.children}</Pre>
        </CodeBlock>
      ),
    },
  });

  return (
    <section
      className={clsx(
        "py-24 md:py-32 border-t border-border",
        BLEED_NEGATIVE_MARGIN,
        BLEED_PADDING,
      )}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3">
              Developer Experience
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              An API that makes sense
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              No wrestling with low-level PDF internals. Load documents, manipulate them with
              intuitive methods, and save. The complexity is handled for you.
            </p>
            <ul className="space-y-3">
              {[
                "Familiar API patterns from pdf-lib",
                "Robust malformed PDF parsing from pdf.js",
                "Incremental saves that preserve signatures",
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">sign-document.ts</span>
            </div>
            {highlighted}
          </div>
        </div>
      </div>
    </section>
  );
}

const comparisons = [
  { feature: "Incremental saves", libpdf: true, pdflib: false, pdfjs: false },
  { feature: "Digital signatures", libpdf: true, pdflib: false, pdfjs: false },
  { feature: "Encrypted PDFs", libpdf: true, pdflib: false, pdfjs: true },
  { feature: "Parse existing PDFs", libpdf: true, pdflib: "partial", pdfjs: true },
  { feature: "Modify existing PDFs", libpdf: true, pdflib: "partial", pdfjs: false },
  { feature: "Generate new PDFs", libpdf: true, pdflib: true, pdfjs: false },
  { feature: "Text extraction", libpdf: true, pdflib: false, pdfjs: true },
  { feature: "Form filling", libpdf: true, pdflib: true, pdfjs: false },
  { feature: "Merge documents", libpdf: true, pdflib: true, pdfjs: false },
  { feature: "Render to image", libpdf: "planned", pdflib: false, pdfjs: true },
  { feature: "TypeScript-first", libpdf: true, pdflib: true, pdfjs: "partial" },
];

function Comparison() {
  return (
    <section
      className={clsx(
        "py-24 md:py-32 border-t border-border",
        BLEED_NEGATIVE_MARGIN,
        BLEED_PADDING,
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3">
            Comparison
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The best of both worlds
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            pdf.js excels at parsing. pdf-lib excels at generation. LibPDF does both, plus
            incremental updates and digital signatures.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 mb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10">
              <Check className="w-3 h-3 text-green-500" />
            </span>
            <span>Supported</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            </span>
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </span>
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted">
              <Minus className="w-3 h-3 text-muted-foreground/50" />
            </span>
            <span>Not supported</span>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-4 font-medium text-muted-foreground" />
                <th className="p-4 font-semibold text-center">
                  <span className="inline-flex items-center justify-center">LibPDF</span>
                </th>
                <th className="p-4 font-medium text-center text-muted-foreground">pdf-lib</th>
                <th className="p-4 font-medium text-center text-muted-foreground">pdf.js</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map(row => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="p-4 font-medium">{row.feature}</td>
                  <td className="p-4 text-center">
                    <StatusIcon value={row.libpdf} highlight />
                  </td>
                  <td className="p-4 text-center">
                    <StatusIcon value={row.pdflib} />
                  </td>
                  <td className="p-4 text-center">
                    <StatusIcon value={row.pdfjs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10">
        <Check className={`w-3.5 h-3.5 ${highlight ? "text-green-500" : "text-green-500/70"}`} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted">
        <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />
      </span>
    );
  }
  if (value === "planned") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
    </span>
  );
}

function SponsorsSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-6 text-center">
          Sponsored by
        </p>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {sponsors.map(sponsor => (
            <a
              key={sponsor.name}
              href={formatSponsorLink(sponsor.href)}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 col-start-2 flex items-center justify-center px-8 py-6 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className={`object-contain h-7 ${sponsor.invertDark ? "dark:invert" : ""}`}
              />
            </a>
          ))}
        </div>
        <div className="text-center">
          <a
            href="https://github.com/sponsors/libpdf-js"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Heart className="w-4 h-4" />
            Become a sponsor
          </a>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section
      className={clsx(
        "py-24 md:py-32 border-t border-border relative overflow-hidden",
        BLEED_NEGATIVE_MARGIN,
        BLEED_PADDING,
      )}
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-t from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Add PDF support in minutes
        </h2>
        <p className="text-muted-foreground mb-10 text-lg">
          Follow the quickstart guide and ship your first PDF feature today.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/docs"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-all"
          >
            Get Started
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs/api"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/50 transition-all"
          >
            API Reference
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  return (
    <main className={clsx("flex-1 overflow-x-hidden", CONTAINER_PADDING)}>
      <Hero />
      <InstallBlock />
      <SponsorsSection />
      <Features />
      <CodeExample />
      <Comparison />
      <CTA />
    </main>
  );
}

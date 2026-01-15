import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { createMdxLink } from "@/components/mdx-link";
import { Sponsors } from "@/components/sponsors";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  const gitConfig = {
    user: "libpdf-js",
    repo: "core",
    branch: "main",
  };

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        footer: (
          <div className="mt-4">
            <Sponsors />
          </div>
        ),
      }}
      full={page.data.full}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          // update it to match your repo
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/content/docs/${page.path}`}
        />
      </div>

      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            // and adds UTM params to external links
            a: createMdxLink(createRelativeLink(source, page)),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}

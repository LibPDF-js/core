import { baseOptions } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout
      {...baseOptions()}
      nav={{
        title: (
          <div>
            LibPDF <span className="text-xs text-muted-foreground font-normal">by Documenso</span>
          </div>
        ),
      }}
      links={[
        {
          type: "main",
          text: "Docs",
          url: "/docs",
        },
        {
          type: "main",
          text: "API Reference",
          url: "/docs/api",
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}

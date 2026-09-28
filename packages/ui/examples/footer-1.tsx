import * as React from "react";
import { AtSign, Github, Linkedin, Youtube } from "lucide-react";
import { Footer } from "@/components/crm/footer";

export default function Example() {
  const [locale, setLocale] = React.useState("en-US");
  return (
    <div className="w-full">
      <Footer
        brand={<span className="text-base font-semibold">Kitbase CRM</span>}
        tagline="The CRM your revenue team actually keeps up to date."
        company="Kitbase Inc."
        columns={[
          {
            title: "Product",
            links: [
              { label: "Pipeline", href: "#" },
              { label: "Forecasting", href: "#", badge: "New" },
              { label: "Integrations", href: "#" },
              { label: "Pricing", href: "#" },
              { label: "Changelog", href: "#" },
            ],
          },
          {
            title: "Resources",
            links: [
              { label: "Help center", href: "#" },
              { label: "API docs", href: "https://example.com/docs", external: true },
              { label: "Templates", href: "#" },
              { label: "Webinars", href: "#" },
            ],
          },
          {
            title: "Company",
            links: [
              { label: "About", href: "#" },
              { label: "Careers", href: "#", badge: "Hiring" },
              { label: "Customers", href: "#" },
              { label: "Contact", href: "#" },
            ],
          },
        ]}
        socials={[
          { label: "LinkedIn", href: "#", icon: <Linkedin /> },
          { label: "GitHub", href: "#", icon: <Github /> },
          { label: "YouTube", href: "#", icon: <Youtube /> },
          { label: "Threads", href: "#", icon: <AtSign /> },
        ]}
        status={{ state: "degraded", href: "#status" }}
        locales={[
          { value: "en-US", label: "English (US)" },
          { value: "en-GB", label: "English (UK)" },
          { value: "de-DE", label: "Deutsch" },
          { value: "hi-IN", label: "हिन्दी" },
        ]}
        locale={locale}
        onLocaleChange={setLocale}
        onSubscribe={async (email) => {
          await new Promise((r) => setTimeout(r, 700));
          if (email.startsWith("test"))
            throw new Error("That address bounced last time. Try another.");
        }}
        legal={[
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
          { label: "DPA", href: "#" },
          { label: "Cookie settings", href: "#" },
        ]}
      />
    </div>
  );
}

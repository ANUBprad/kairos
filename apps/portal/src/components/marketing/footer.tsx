import Link from "next/link";
import Image from "next/image";
import { Github, Twitter, MessageCircle, Mail } from "lucide-react";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: "https://github.com/kairos-ai/kairos" },
      { label: "Architecture", href: "/docs/architecture" },
      { label: "Deployment", href: "/docs/deployment" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

const socialLinks = [
  { label: "GitHub", href: "https://github.com/kairos-ai/kairos", icon: Github },
  { label: "Twitter / X", href: "https://x.com/kairos_ai", icon: Twitter },
  { label: "Discord", href: "https://discord.gg/kairos", icon: MessageCircle },
  { label: "Email", href: "mailto:hello@kairos.dev", icon: Mail },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4" aria-label="Kairos home">
              <Image
                src="/kai.png"
                alt="Kairos"
                width={28}
                height={28}
                className="object-contain"
              />
            </Link>
            <p className="text-[13px] text-text-tertiary leading-relaxed max-w-[200px]">
              RAG Research Platform
            </p>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-semibold text-text-primary mb-5 tracking-wide">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-text-secondary hover:text-text-primary transition-colors duration-200"
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-[12px] text-text-tertiary">
            &copy; 2026 Kairos. MIT License.
          </p>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Link
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-tertiary hover:text-text-primary transition-colors duration-200"
                  aria-label={social.label}
                >
                  <Icon size={16} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Helmet } from "react-helmet-async";

interface FAQItem {
  question: string;
  answer: string;
}

interface ToolSEOProps {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string[];
  faq?: FAQItem[];
  /** Short "how to use" steps for HowTo schema */
  howToSteps?: string[];
  /**
   * Absolute URL of the Open Graph image for this page.
   * Falls back to the site-wide OG image set in index.html.
   */
  ogImage?: string;
  /**
   * Pass false for the home / launcher page, which is not a WebApplication.
   * Defaults to true for every tool page.
   */
  isApp?: boolean;
}

const BASE_URL = "https://toolzy.lovable.app";

/** Shared OG image (1200×630) used as the fallback for all tool pages. */
const DEFAULT_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8941552-9ffd-43fb-a460-b27723f2980b/id-preview-75720018--c01f4f33-6220-46a1-bfb7-420b0ce8af24.lovable.app-1774889779954.png";

export function ToolSEO({
  title,
  description,
  canonicalPath,
  keywords = [],
  faq = [],
  howToSteps = [],
  ogImage = DEFAULT_OG_IMAGE,
  isApp = true,
}: ToolSEOProps) {
  // Home page uses a plain title; tool pages get the full suffix.
  const fullTitle =
    canonicalPath === "/"
      ? title
      : `${title} — Free Online Tool | Toolzy`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  // BreadcrumbList — helps search engines and AI engines show navigation context.
  const breadcrumbSchema = canonicalPath !== "/" && {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Toolzy",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: canonicalUrl,
      },
    ],
  };

  const webAppSchema = isApp && {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    description,
    url: canonicalUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (Browser-based)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Toolzy",
      url: BASE_URL,
    },
  };

  const faqSchema =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  const howToSchema =
    howToSteps.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: `How to use ${title}`,
          step: howToSteps.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            text,
          })),
        }
      : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Toolzy" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {webAppSchema && (
        <script type="application/ld+json">
          {JSON.stringify(webAppSchema)}
        </script>
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
      {howToSchema && (
        <script type="application/ld+json">
          {JSON.stringify(howToSchema)}
        </script>
      )}
    </Helmet>
  );
}

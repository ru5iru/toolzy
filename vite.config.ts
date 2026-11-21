import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  worker: {
    format: "es",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    // Raise the warning threshold: all large chunks are lazy (never in the
    // initial load path). The only genuinely unavoidable one is vendor-faker
    // (~2 MB minified) — Faker.js data files cannot be tree-shaken further.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // React runtime — always eagerly loaded; isolate for stable long-term caching.
          // Use /node_modules/react/ (not /react/) to avoid false-matching scoped
          // packages whose paths contain "/react/" (e.g. @tiptap/react, @uiw/react-*).
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) return "vendor-react";
          // Routing + query layer — shared across all routes
          if (id.includes("/react-router") || id.includes("/@tanstack/")) return "vendor-router";
          // Icon set — imported eagerly by Index; isolate to keep other chunks slim
          if (id.includes("/lucide-react")) return "vendor-icons";
          // Radix-UI primitives — many packages, shared by AppLayout/shadcn components
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          // Large tool-specific libraries; named chunks aid long-term caching
          // even though each is only loaded by one lazy route
          if (id.includes("/@faker-js/faker")) return "vendor-faker";
          if (id.includes("/@tiptap/") || id.includes("/tiptap/") || id.includes("/@prosemirror/")) return "vendor-tiptap";
          if (id.includes("/@codemirror/") || id.includes("/@uiw/react-codemirror")) return "vendor-codemirror";
          if (id.includes("/sql-formatter")) return "vendor-sql";
          // Unified / rehype / remark / micromark / hast / lowlight ecosystem —
          // only loaded by MarkdownEditor; split from the page chunk for caching
          if (
            id.includes("/react-markdown") ||
            id.includes("/unified") ||
            id.includes("/rehype") ||
            id.includes("/remark-") ||
            id.includes("/micromark") ||
            id.includes("/mdast") ||
            id.includes("/hast") ||
            id.includes("/vfile") ||
            id.includes("/unist") ||
            id.includes("/lowlight") ||
            id.includes("/highlight.js")
          ) return "vendor-markdown";
          // No catch-all: everything else stays in the route chunk that imports it,
          // so single-route deps (exifr, diff, recharts, etc.) remain lazy.
        },
      },
    },
  },
}));

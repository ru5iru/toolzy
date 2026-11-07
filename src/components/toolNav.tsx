import {
  Braces, Code2, Palette, ShieldCheck, GitCompare, Users, FileText, KeyRound, Clock, Regex, FileSearch, FileSignature, ScrollText, Type, FileCode2,
} from "lucide-react";

/** Sidebar entries; also used by the top bar to name the current tool. */
export const toolNav = [
  { title: "Markdown Editor", url: "/markdown", icon: FileText },
  { title: "HTML Editor", url: "/html-editor", icon: FileCode2 },
  { title: "JSON Formatter", url: "/json", icon: Braces },
  { title: "Encoding Hub", url: "/encode", icon: Code2 },
  { title: "Crypto Suite", url: "/crypto", icon: KeyRound },
  { title: "Color Converter", url: "/color", icon: Palette },
  { title: "JWT Hub", url: "/jwt", icon: ShieldCheck },
  { title: "API Diff", url: "/diff", icon: GitCompare },
  { title: "Fake Data", url: "/fake-data", icon: Users },
  { title: "Env Generator", url: "/env", icon: FileText },
  { title: "Date & Time", url: "/datetime", icon: Clock },
  { title: "Regex", url: "/regex", icon: Regex },
  { title: "Image Metadata Viewer", url: "/image-metadata", icon: FileSearch },
  { title: "Document Signer", url: "/document-signer", icon: FileSignature },
  { title: "Text Utilities", url: "/text", icon: Type },
  { title: "Certificate Inspector", url: "/certificate", icon: ScrollText },
];

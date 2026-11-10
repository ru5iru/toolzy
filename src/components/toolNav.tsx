import {
  Braces, Code2, Palette, ShieldCheck, GitCompare, Users, FileText, KeyRound, Clock, Regex, FileSearch, FileSignature, ScrollText, Type, FileCode2, Terminal, Database, Binary, Timer, Diff, FileJson2, Lock, KeySquare, Table2,
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
  { title: "Env Generator", url: "/env", icon: Terminal },
  { title: "Date & Time", url: "/datetime", icon: Clock },
  { title: "Regex", url: "/regex", icon: Regex },
  { title: "Image Metadata Viewer", url: "/image-metadata", icon: FileSearch },
  { title: "Document Signer", url: "/document-signer", icon: FileSignature },
  { title: "Text Utilities", url: "/text", icon: Type },
  { title: "Certificate Inspector", url: "/certificate", icon: ScrollText },
  { title: "SQL Formatter", url: "/sql", icon: Database },
  { title: "Number Base Converter", url: "/number-base", icon: Binary },
  { title: "Cron Builder", url: "/cron", icon: Timer },
  { title: "Text & Code Diff", url: "/text-diff", icon: Diff },
  { title: "YAML / JSON / TOML", url: "/yaml", icon: FileJson2 },
  { title: "chmod Calculator", url: "/chmod", icon: Lock },
  { title: "Password Generator", url: "/password", icon: KeySquare },
  { title: "CSV Tool", url: "/csv", icon: Table2 },
];

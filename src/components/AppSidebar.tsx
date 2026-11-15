import {
  Braces,
  Binary,
  Code2,
  Palette,
  Wrench,
  ShieldCheck,
  GitCompare,
  Users,
  FileText,
  KeyRound,
  Clock,
  Regex,
  FileSearch,
  FileSignature,
  ScrollText,
  Type,
  FileCode2,
  Database,
  Timer,
  Diff,
  FileJson2,
  Lock,
  KeySquare,
  Table2,
  ArrowLeftRight,
  Fingerprint,
  Link2,
  Hash,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Text & Docs",
    tools: [
      { title: "HTML Editor", url: "/html-editor", icon: FileCode2 },
      { title: "Markdown Editor", url: "/markdown", icon: FileText },
      { title: "Text Utilities", url: "/text", icon: Type },
      { title: "Text & Code Diff", url: "/text-diff", icon: Diff },
    ],
  },
  {
    label: "Data & Format",
    tools: [
      { title: "JSON Formatter", url: "/json", icon: Braces },
      { title: "JSON Transformer", url: "/json-transform", icon: FileJson2 },
      { title: "YAML / JSON / TOML", url: "/yaml", icon: FileJson2 },
      { title: "CSV Tool", url: "/csv", icon: Table2 },
      { title: "SQL Formatter", url: "/sql", icon: Database },
    ],
  },
  {
    label: "Encoding & Security",
    tools: [
      { title: "Encoding Hub", url: "/encode", icon: Binary },
      { title: "Crypto Suite", url: "/crypto", icon: Fingerprint },
      { title: "JWT Hub", url: "/jwt", icon: KeyRound },
      { title: "Password Generator", url: "/password", icon: KeySquare },
      { title: "Document Signer", url: "/document-signer", icon: FileSignature },
      { title: "Certificate Inspector", url: "/certificate", icon: ScrollText },
    ],
  },
  {
    label: "Network & Code",
    tools: [
      { title: "API Diff", url: "/diff", icon: GitCompare },
      { title: "curl ↔ Code", url: "/curl", icon: ArrowLeftRight },
      { title: "Env Generator", url: "/env", icon: Hash },
    ],
  },
  {
    label: "Visual & Media",
    tools: [
      { title: "Color Converter", url: "/color", icon: Palette },
      { title: "Image Metadata", url: "/image-metadata", icon: FileSearch },
    ],
  },
  {
    label: "Utilities",
    tools: [
      { title: "Fake Data", url: "/fake-data", icon: Users },
      { title: "Date & Time", url: "/datetime", icon: Clock },
      { title: "Regex Playground", url: "/regex", icon: Regex },
      { title: "Number Base", url: "/number-base", icon: Binary },
      { title: "Cron Builder", url: "/cron", icon: Timer },
      { title: "chmod Calculator", url: "/chmod", icon: Lock },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-mono text-sm font-bold tracking-tight text-foreground">
              Toolzy
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-muted-foreground text-[10px] uppercase tracking-widest">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.tools.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        aria-label={item.title}
                        title={item.title}
                        className="hover:bg-secondary"
                        activeClassName="bg-secondary text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span>{item.title}</span>}
                        {collapsed && <span className="sr-only">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

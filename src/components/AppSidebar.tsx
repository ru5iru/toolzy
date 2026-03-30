import {
  Braces,
  Binary,
  Link,
  Fingerprint,
  Palette,
  Wrench,
  KeyRound,
  GitCompare,
  Users,
  FileText,
  Hash,
  Clock,
  Regex,
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

const tools = [
  { title: "JSON Formatter", url: "/json", icon: Braces },
  { title: "Base64", url: "/base64", icon: Binary },
  { title: "URL Encode", url: "/url-encode", icon: Link },
  { title: "UUID Generator", url: "/uuid", icon: Fingerprint },
  { title: "Color Converter", url: "/color", icon: Palette },
  { title: "JWT Decoder", url: "/jwt", icon: KeyRound },
  { title: "API Diff", url: "/diff", icon: GitCompare },
  { title: "Fake Data", url: "/fake-data", icon: Users },
  { title: "Env Generator", url: "/env", icon: FileText },
  { title: "Hash Generator", url: "/hash", icon: Hash },
  { title: "Date & Time", url: "/datetime", icon: Clock },
  { title: "Regex", url: "/regex", icon: Regex },
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
              DevTools
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] uppercase tracking-widest">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-secondary"
                      activeClassName="bg-secondary text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

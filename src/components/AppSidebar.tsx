import { Wrench } from "lucide-react";
import { toolNav } from "@/components/toolNav";
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] uppercase tracking-widest">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      aria-label={item.title}
                      title={item.title}
                      className="transition-colors duration-150 hover:bg-secondary hover:text-foreground"
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
      </SidebarContent>
    </Sidebar>
  );
}

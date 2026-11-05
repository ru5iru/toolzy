import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toolNav } from "@/components/toolNav";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const workspace = pathname === "/markdown";
  const current = toolNav.find((t) => t.url === pathname)?.title;
  return (
    <SidebarProvider>
      <div className={workspace ? "h-dvh min-h-0 flex w-full overflow-hidden" : "min-h-screen flex w-full"}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <SidebarTrigger />
            {current && <span className="truncate font-mono text-xs text-muted-foreground">{current}</span>}
          </div>
          <main className={workspace ? "flex-1 min-h-0 overflow-hidden" : "flex-1 p-3 sm:p-4 lg:p-5 overflow-auto"}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

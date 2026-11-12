import { Moon, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toolNav } from "@/components/toolNav";
import { CommandPalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
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
            <CommandPalette />
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 shrink-0"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggle}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <main className={workspace ? "flex-1 min-h-0 overflow-hidden" : "flex-1 p-3 sm:p-4 lg:p-5 overflow-auto"}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toolNav } from "@/components/toolNav";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const workspace = pathname === "/markdown";

  // Ctrl/Cmd+Shift+L → theme toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);
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
            <div className="ml-auto flex items-center gap-1">
              <KeyboardShortcuts />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={theme === "dark" ? "Switch to light mode (Ctrl Shift L)" : "Switch to dark mode (Ctrl Shift L)"}
                onClick={toggle}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <main className={workspace ? "flex-1 min-h-0 overflow-hidden" : "flex-1 p-3 sm:p-4 lg:p-5 overflow-auto"}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

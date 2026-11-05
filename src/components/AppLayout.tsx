import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const workspace = useLocation().pathname === "/markdown";
  return (
    <SidebarProvider>
      <div className={workspace ? "h-dvh min-h-0 flex w-full overflow-hidden" : "min-h-screen flex w-full"}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
            <SidebarTrigger />
          </header>
          <main className={workspace ? "flex-1 min-h-0 overflow-hidden" : "flex-1 p-6 overflow-auto"}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

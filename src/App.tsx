import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import JsonFormatter from "./pages/JsonFormatter";
import Base64Tool from "./pages/Base64Tool";
import UrlEncodeTool from "./pages/UrlEncodeTool";
import UuidGenerator from "./pages/UuidGenerator";
import ColorConverter from "./pages/ColorConverter";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/json" element={<JsonFormatter />} />
            <Route path="/base64" element={<Base64Tool />} />
            <Route path="/url-encode" element={<UrlEncodeTool />} />
            <Route path="/uuid" element={<UuidGenerator />} />
            <Route path="/color" element={<ColorConverter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

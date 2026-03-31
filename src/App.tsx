import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
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
import JwtDecoder from "./pages/JwtDecoder";
import ApiDiffTool from "./pages/ApiDiffTool";
import FakeDataGenerator from "./pages/FakeDataGenerator";
import EnvGenerator from "./pages/EnvGenerator";
import HashGenerator from "./pages/HashGenerator";
import DateTimeTool from "./pages/DateTimeTool";
import RegexPlayground from "./pages/RegexPlayground";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
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
            <Route path="/jwt" element={<JwtDecoder />} />
            <Route path="/diff" element={<ApiDiffTool />} />
            <Route path="/fake-data" element={<FakeDataGenerator />} />
            <Route path="/env" element={<EnvGenerator />} />
            <Route path="/hash" element={<HashGenerator />} />
            <Route path="/datetime" element={<DateTimeTool />} />
            <Route path="/regex" element={<RegexPlayground />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;

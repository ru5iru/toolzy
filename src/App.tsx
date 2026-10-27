import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";

const JsonFormatter = lazy(() => import("./pages/JsonFormatter"));
const EncodingHub = lazy(() => import("./pages/EncodingHub"));
const CryptoSuite = lazy(() => import("./pages/CryptoSuite"));
const ColorConverter = lazy(() => import("./pages/ColorConverter"));
const JwtHub = lazy(() => import("./pages/JwtHub"));
const ApiDiffTool = lazy(() => import("./pages/ApiDiffTool"));
const FakeDataGenerator = lazy(() => import("./pages/FakeDataGenerator"));
const EnvGenerator = lazy(() => import("./pages/EnvGenerator"));
const DateTimeTool = lazy(() => import("./pages/DateTimeTool"));
const RegexPlayground = lazy(() => import("./pages/RegexPlayground"));
const ImageMetadataViewer = lazy(() => import("./pages/ImageMetadataViewer"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[300px]" role="status" aria-label="Loading tool">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppLayout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/json" element={<JsonFormatter />} />
              <Route path="/encode" element={<EncodingHub />} />
              <Route path="/base64" element={<Navigate to="/encode" replace />} />
              <Route path="/url-encode" element={<Navigate to="/encode?mode=url" replace />} />
              <Route path="/crypto" element={<CryptoSuite />} />
              <Route path="/uuid" element={<Navigate to="/crypto?tab=uuid" replace />} />
              <Route path="/hash" element={<Navigate to="/crypto?tab=hash" replace />} />
              <Route path="/color" element={<ColorConverter />} />
              <Route path="/jwt" element={<JwtHub />} />
              <Route path="/jwt-encoder" element={<Navigate to="/jwt" replace />} />
              <Route path="/diff" element={<ApiDiffTool />} />
              <Route path="/fake-data" element={<FakeDataGenerator />} />
              <Route path="/env" element={<EnvGenerator />} />
              <Route path="/datetime" element={<DateTimeTool />} />
              <Route path="/regex" element={<RegexPlayground />} />
              <Route path="/image-metadata" element={<ImageMetadataViewer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Copy, Heart, Trash2, Upload, RotateCcw, Star, Check, Pipette } from "lucide-react";
import {
  parseColor, rgbToHex, rgbToHsl, rgbToHsv, rgbToCmyk, hslToRgb,
  formatRgb, formatHsl, formatHsv, formatCmyk,
  generatePalette, contrastRatio, closestColorName, closestTailwind,
  extractColors, luminance,
  type RGB, type HSL,
} from "@/components/color/colorUtils";

// ===== History / Favorites =====
const HISTORY_KEY = "toolzy_color_history";
const FAVORITES_KEY = "toolzy_color_favorites";
const loadArr = (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
const saveArr = (k: string, v: string[]) => localStorage.setItem(k, JSON.stringify(v));

const ColorConverter = () => {
  // Read initial color from URL
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("value") || "#3ecfcf";

  const [input, setInput] = useState(initial);
  const [history, setHistory] = useState<string[]>(loadArr(HISTORY_KEY));
  const [favorites, setFavorites] = useState<string[]>(loadArr(FAVORITES_KEY));
  const [paletteType, setPaletteType] = useState("complementary");
  const [fgInput, setFgInput] = useState("#ffffff");
  const [bgInput, setBgInput] = useState("#000000");
  const [gradStops, setGradStops] = useState(["#3ecfcf", "#6366f1"]);
  const [gradAngle, setGradAngle] = useState(135);
  const [gradType, setGradType] = useState<"linear" | "radial">("linear");
  const [batchInput, setBatchInput] = useState("");
  const [bgToggle, setBgToggle] = useState<"dark" | "light">("dark");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [extractedColors, setExtractedColors] = useState<RGB[]>([]);

  const rgb = useMemo(() => parseColor(input), [input]);
  const hsl = useMemo(() => rgb ? rgbToHsl(rgb) : null, [rgb]);
  const hsv = useMemo(() => rgb ? rgbToHsv(rgb) : null, [rgb]);
  const cmyk = useMemo(() => rgb ? rgbToCmyk(rgb) : null, [rgb]);
  const hex = useMemo(() => rgb ? rgbToHex(rgb) : "", [rgb]);
  const colorName = useMemo(() => rgb ? closestColorName(rgb) : "", [rgb]);
  const twClass = useMemo(() => rgb ? closestTailwind(rgb) : "", [rgb]);

  // Sync URL
  useEffect(() => {
    if (rgb) {
      const url = new URL(window.location.href);
      url.searchParams.set("value", hex);
      window.history.replaceState({}, "", url.toString());
    }
  }, [hex, rgb]);

  // Add to history on valid parse
  useEffect(() => {
    if (rgb && hex) {
      setHistory(prev => {
        const next = [hex, ...prev.filter(h => h !== hex)].slice(0, 20);
        saveArr(HISTORY_KEY, next);
        return next;
      });
    }
  }, [hex, rgb]);

  const copy = useCallback((text: string, key?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key || text);
    toast.success("Copied!");
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const toggleFavorite = (color: string) => {
    setFavorites(prev => {
      const next = prev.includes(color) ? prev.filter(f => f !== color) : [color, ...prev].slice(0, 50);
      saveArr(FAVORITES_KEY, next);
      return next;
    });
  };

  // HSL sliders
  const updateFromHsl = (field: keyof HSL, val: number) => {
    if (!hsl) return;
    const newHsl = { ...hsl, [field]: val };
    const newRgb = hslToRgb(newHsl);
    setInput(rgbToHex(newRgb));
  };

  // Image extraction
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.min(200 / img.width, 200 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setExtractedColors(extractColors(data, 8));
    };
    img.src = URL.createObjectURL(file);
  };

  // Batch convert
  const batchResults = useMemo(() => {
    return batchInput.split("\n").filter(Boolean).map(line => {
      const parsed = parseColor(line.trim());
      if (!parsed) return { input: line.trim(), hex: "Invalid", rgb: "", hsl: "" };
      return {
        input: line.trim(),
        hex: rgbToHex(parsed),
        rgb: formatRgb(parsed),
        hsl: formatHsl(rgbToHsl(parsed)),
      };
    });
  }, [batchInput]);

  // Contrast
  const fgRgb = useMemo(() => parseColor(fgInput), [fgInput]);
  const bgRgb = useMemo(() => parseColor(bgInput), [bgInput]);
  const ratio = useMemo(() => fgRgb && bgRgb ? contrastRatio(fgRgb, bgRgb) : 0, [fgRgb, bgRgb]);

  // Gradient CSS
  const gradientCss = gradType === "linear"
    ? `linear-gradient(${gradAngle}deg, ${gradStops.join(", ")})`
    : `radial-gradient(circle, ${gradStops.join(", ")})`;

  const CopyBtn = ({ text, k }: { text: string; k: string }) => (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(text, k)}>
      {copiedKey === k ? <Check className="h-3.5 w-3.5 text-[hsl(var(--success-foreground))]" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );

  const ColorSwatch = ({ color, small, onClick }: { color: RGB; small?: boolean; onClick?: () => void }) => {
    const h = rgbToHex(color);
    return (
      <div
        className={`${small ? "w-8 h-8" : "w-12 h-12"} rounded-md border border-border cursor-pointer hover:scale-105 transition-transform`}
        style={{ backgroundColor: h }}
        onClick={() => { onClick?.(); copy(h, h); }}
        title={h}
      />
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ToolSEO
        title="Color Converter & Toolkit"
        description="Convert colors between HEX, RGB, HSL, HSV, CMYK. Generate palettes, check WCAG contrast, create gradients, and extract colors from images. Free online tool."
        canonicalPath="/color"
        keywords={["color converter", "HEX to RGB", "color palette generator", "WCAG contrast checker", "gradient generator", "color picker"]}
        faq={[
          { question: "What is HEX color?", answer: "HEX color is a 6-digit hexadecimal representation of RGB color values, commonly used in web development. For example, #FF0000 represents pure red." },
          { question: "What's the difference between RGB and HSL?", answer: "RGB defines colors by Red, Green, Blue channel values (0-255). HSL defines colors by Hue (0-360°), Saturation (0-100%), and Lightness (0-100%), which is more intuitive for color manipulation." },
          { question: "How is WCAG contrast ratio calculated?", answer: "WCAG contrast ratio compares the relative luminance of two colors. A ratio of 4.5:1 is required for AA compliance (normal text) and 7:1 for AAA." },
          { question: "What is CMYK used for?", answer: "CMYK (Cyan, Magenta, Yellow, Key/Black) is used in print design. Unlike RGB which is additive (light), CMYK is subtractive (ink)." },
        ]}
        howToSteps={[
          "Enter any color value (HEX, RGB, HSL, HSV, HWB, or CSS name)",
          "See instant conversions to all formats with one-click copy",
          "Use sliders to fine-tune hue, saturation, lightness, and opacity",
          "Generate color palettes, check contrast, or create gradients",
        ]}
      />

      <h1 className="text-2xl font-mono font-bold text-foreground">Color Converter & Toolkit</h1>

      {/* === Top: Input + Preview + Formats === */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
        {/* Left: Input + Preview */}
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div
              className="w-16 h-16 rounded-lg border border-border shrink-0 shadow-lg transition-colors"
              style={{ backgroundColor: rgb ? hex : "#000" }}
            />
            <div className="flex-1 space-y-1">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="#3ecfcf or rgb(62,207,207)"
                  className="font-mono text-sm bg-card border-border"
                  aria-label="Color input"
                />
                <input
                  type="color"
                  value={rgb ? hex.substring(0, 7) : "#000000"}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent"
                  aria-label="Color picker"
                />
                {"EyeDropper" in window && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label="Pick color from screen"
                    title="Pick color from screen"
                    onClick={async () => {
                      try {
                        const result = await (new (window as any).EyeDropper()).open();
                        setInput(result.sRGBHex);
                        toast.success(`Picked ${result.sRGBHex}`);
                      } catch { /* user cancelled */ }
                    }}
                  >
                    <Pipette className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {rgb && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Pipette className="h-3 w-3" />
                  <span>{colorName}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-mono">bg-{twClass}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => toggleFavorite(hex)}>
                    <Heart className={`h-3 w-3 ${favorites.includes(hex) ? "fill-red-400 text-destructive" : ""}`} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Preview with bg toggle */}
          {rgb && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
                <div className="flex gap-1">
                  {(["dark", "light"] as const).map(t => (
                    <button key={t} onClick={() => setBgToggle(t)}
                      className={`text-[10px] px-2 py-0.5 rounded ${bgToggle === t ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 flex items-center justify-center" style={{ backgroundColor: bgToggle === "dark" ? "#111" : "#f5f5f5" }}>
                <div className="w-32 h-20 rounded-lg shadow-lg" style={{ backgroundColor: hex }} />
              </div>
            </div>
          )}

          {/* Sliders */}
          {hsl && (
            <div className="space-y-3 p-3 rounded-lg border border-border bg-card">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Adjust</span>
              {[
                { label: "H", value: hsl.h, max: 360, field: "h" as const },
                { label: "S", value: hsl.s, max: 100, field: "s" as const },
                { label: "L", value: hsl.l, max: 100, field: "l" as const },
                { label: "A", value: Math.round(hsl.a * 100), max: 100, field: "a" as const },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-4 text-muted-foreground">{s.label}</span>
                  <Slider
                    value={[s.value]}
                    max={s.max}
                    step={1}
                    onValueChange={([v]) => updateFromHsl(s.field, s.field === "a" ? v / 100 : v)}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono w-8 text-right text-muted-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Format outputs */}
        {rgb && hsl && hsv && cmyk && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Formats</span>
            {[
              { label: "HEX", value: hex.toUpperCase() },
              { label: "RGB", value: formatRgb(rgb) },
              { label: "HSL", value: formatHsl(hsl) },
              { label: "HSV", value: formatHsv(hsv) },
              { label: "CMYK", value: formatCmyk(cmyk) },
              { label: "CSS Var", value: `--color: ${hex};` },
              { label: "SCSS", value: `$color: ${hex};` },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 group hover:border-primary/40 transition-colors">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-14">{row.label}</span>
                <code className="font-mono text-xs text-foreground flex-1 text-right mr-2 truncate">{row.value}</code>
                <CopyBtn text={row.value} k={row.label} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Tabs for advanced features === */}
      <Tabs defaultValue="palette" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {["palette", "contrast", "gradient", "extract", "batch", "history"].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* Palette */}
        <TabsContent value="palette" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {["complementary", "analogous", "triadic", "tetradic", "monochromatic", "shades", "tints"].map(t => (
              <button key={t} onClick={() => setPaletteType(t)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${paletteType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {t}
              </button>
            ))}
          </div>
          {rgb && (
            <div className="flex flex-wrap gap-2">
              {generatePalette(rgb, paletteType).map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ColorSwatch color={c} onClick={() => setInput(rgbToHex(c))} />
                  <span className="text-[10px] font-mono text-muted-foreground">{rgbToHex(c)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contrast */}
        <TabsContent value="contrast" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Foreground</label>
              <div className="flex gap-2">
                <Input value={fgInput} onChange={e => setFgInput(e.target.value)} className="font-mono text-sm bg-card border-border" />
                <input type="color" value={fgRgb ? rgbToHex(fgRgb).substring(0, 7) : "#ffffff"} onChange={e => setFgInput(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Background</label>
              <div className="flex gap-2">
                <Input value={bgInput} onChange={e => setBgInput(e.target.value)} className="font-mono text-sm bg-card border-border" />
                <input type="color" value={bgRgb ? rgbToHex(bgRgb).substring(0, 7) : "#000000"} onChange={e => setBgInput(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent" />
              </div>
            </div>
          </div>
          {fgRgb && bgRgb && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-4" style={{ backgroundColor: rgbToHex(bgRgb), color: rgbToHex(fgRgb) }}>
                <p className="text-lg font-bold">Sample Heading Text</p>
                <p className="text-sm">This is sample body text to preview contrast.</p>
                <p className="text-xs">Small text for AAA compliance check.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{ratio.toFixed(2)}:1</div>
                  <div className="text-[10px] text-muted-foreground">Contrast Ratio</div>
                </div>
                <div className={`rounded-md border p-3 text-center ${ratio >= 4.5 ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className={`text-lg font-bold ${ratio >= 4.5 ? "text-[hsl(var(--success-foreground))]" : "text-destructive"}`}>{ratio >= 4.5 ? "PASS" : "FAIL"}</div>
                  <div className="text-[10px] text-muted-foreground">WCAG AA (4.5:1)</div>
                </div>
                <div className={`rounded-md border p-3 text-center ${ratio >= 7 ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className={`text-lg font-bold ${ratio >= 7 ? "text-[hsl(var(--success-foreground))]" : "text-destructive"}`}>{ratio >= 7 ? "PASS" : "FAIL"}</div>
                  <div className="text-[10px] text-muted-foreground">WCAG AAA (7:1)</div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Gradient */}
        <TabsContent value="gradient" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-1">
              {(["linear", "radial"] as const).map(t => (
                <button key={t} onClick={() => setGradType(t)}
                  className={`text-xs px-3 py-1.5 rounded-md border ${gradType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
            {gradType === "linear" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Angle</span>
                <Slider value={[gradAngle]} max={360} step={1} onValueChange={([v]) => setGradAngle(v)} className="w-32" />
                <span className="text-xs font-mono text-muted-foreground w-8">{gradAngle}°</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {gradStops.map((stop, i) => (
              <div key={i} className="flex items-center gap-1">
                <input type="color" value={stop} onChange={e => {
                  const next = [...gradStops]; next[i] = e.target.value; setGradStops(next);
                }} className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent" />
                {gradStops.length > 2 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGradStops(gradStops.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setGradStops([...gradStops, "#ffffff"])} className="text-xs h-8">
              + Stop
            </Button>
          </div>
          <div className="w-full h-24 rounded-lg border border-border" style={{ background: gradientCss }} />
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded border border-border truncate">
              background: {gradientCss};
            </code>
            <CopyBtn text={`background: ${gradientCss};`} k="gradient" />
          </div>
        </TabsContent>

        {/* Image Extract */}
        <TabsContent value="extract" className="space-y-4 mt-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => imgInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && imgInputRef.current) {
                const dt = new DataTransfer(); dt.items.add(file);
                imgInputRef.current.files = dt.files;
                imgInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drop an image or click to upload</p>
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <canvas ref={canvasRef} className="hidden" />
          {extractedColors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extractedColors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ColorSwatch color={c} onClick={() => setInput(rgbToHex(c))} />
                  <span className="text-[10px] font-mono text-muted-foreground">{rgbToHex(c)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Batch */}
        <TabsContent value="batch" className="space-y-4 mt-4">
          <Textarea
            value={batchInput}
            onChange={e => setBatchInput(e.target.value)}
            placeholder={"#ff0000\nrgb(0,128,255)\nhsl(120,50%,50%)\nteal"}
            className="font-mono text-xs bg-card border-border min-h-[100px]"
            aria-label="Batch color input"
          />
          {batchResults.length > 0 && batchResults[0].input && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Input</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">HEX</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">RGB</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">HSL</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 flex items-center gap-2">
                          {r.hex !== "Invalid" && <div className="w-4 h-4 rounded shrink-0 border border-border" style={{ backgroundColor: r.hex }} />}
                          <span className="truncate">{r.input}</span>
                        </td>
                        <td className="px-3 py-2">{r.hex}</td>
                        <td className="px-3 py-2">{r.rgb}</td>
                        <td className="px-3 py-2">{r.hsl}</td>
                        <td className="px-3 py-2">{r.hex !== "Invalid" && <CopyBtn text={r.hex} k={`batch-${i}`} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* History & Favorites */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Star className="h-3 w-3" /> Favorites</span>
              {favorites.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setFavorites([]); saveArr(FAVORITES_KEY, []); }}>
                  Clear
                </Button>
              )}
            </div>
            {favorites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Click the heart icon on any color to save it.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {favorites.map(c => (
                  <div key={c} className="flex flex-col items-center gap-1 group">
                    <div className="w-10 h-10 rounded-md border border-border cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: c }} onClick={() => setInput(c)} />
                    <span className="text-[9px] font-mono text-muted-foreground">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Recent</span>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setHistory([]); saveArr(HISTORY_KEY, []); }}>
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 20).map(c => (
                <div key={c} className="w-8 h-8 rounded border border-border cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: c }} onClick={() => setInput(c)} title={c} />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* === SEO Content === */}
      <div className="space-y-6 pt-6 border-t border-border">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">What is HEX Color?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            HEX color codes are a hexadecimal representation of RGB values used widely in web development and CSS. A HEX code like <code className="text-primary">#3ecfcf</code> maps to specific red, green, and blue channel values. The 6-digit format uses pairs of hex digits (00-FF) for each channel. An optional 8-digit format adds alpha transparency.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">HEX to RGB Conversion</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Converting HEX to RGB splits the 6-character string into three pairs. Each pair is converted from base-16 to base-10. For example, <code className="text-primary">#3ecfcf</code> → R: 62 (0x3e), G: 207 (0xcf), B: 207 (0xcf), giving <code className="text-primary">rgb(62, 207, 207)</code>.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">When to Use HSL vs RGB</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            HSL (Hue, Saturation, Lightness) is more intuitive for creating color variations — adjusting lightness creates tints and shades, while saturation controls vibrancy. RGB is closer to how screens display color. Use HSL when designing palettes and RGB/HEX for final implementation.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">WCAG Color Contrast Guidelines</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Web Content Accessibility Guidelines (WCAG) require a minimum contrast ratio of 4.5:1 for normal text (AA) and 7:1 for enhanced readability (AAA). Large text (18px+ bold or 24px+) requires 3:1 for AA. Use the contrast checker above to verify your color combinations meet accessibility standards.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ColorConverter;

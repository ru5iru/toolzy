import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const ColorConverter = () => {
  const [hex, setHex] = useState("#3ecfcf");

  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const validHex = /^#?[0-9a-fA-F]{6}$/.test(hex);
  const displayHex = hex.startsWith("#") ? hex : `#${hex}`;

  return (
    <div className="max-w-lg mx-auto">
      <ToolSEO title="Color Converter" description="Convert colors between HEX, RGB, and HSL formats instantly. Free online color converter with live preview." canonicalPath="/color" keywords={["color converter", "HEX to RGB", "RGB to HSL", "color picker", "convert color online"]} faq={[{question:"How do I convert HEX to RGB?",answer:"Enter a 6-digit HEX color code (e.g., #3B82F6) and the tool instantly shows the equivalent RGB and HSL values."},{question:"What color formats are supported?",answer:"This tool converts between HEX (e.g., #FF5733), RGB (e.g., rgb(255,87,51)), and HSL (e.g., hsl(11,100%,60%))."}]} howToSteps={["Enter a HEX color code in the input field","See the live color preview and RGB/HSL values","Click any value to copy it to your clipboard"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground mb-6">Color Converter</h1>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-lg border border-border shrink-0"
            style={{ backgroundColor: validHex ? displayHex : "#000" }}
          />
          <Input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#3ecfcf"
            className="font-mono text-sm bg-card border-border"
          />
        </div>

        {rgb && hsl && (
          <div className="space-y-2">
            {[
              { label: "HEX", value: displayHex.toUpperCase() },
              { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
              { label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
            ].map((row) => (
              <div
                key={row.label}
                onClick={() => copy(row.value)}
                className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors"
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-10">{row.label}</span>
                <code className="font-mono text-sm text-foreground">{row.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorConverter;

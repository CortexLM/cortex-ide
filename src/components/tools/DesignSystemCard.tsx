import { Show, For, createSignal, createEffect, onMount, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { ToolCall, useSDK } from "@/context/SDKContext";
import { Card, Button, Text, Badge, IconButton } from "@/components/ui";

interface FontWeight {
  value: number;
  name: string;
}

interface FontFamily {
  name: string;
  category: string;
  weights: FontWeight[];
  popular?: boolean;
}

interface PaletteColor {
  name: string;
  hex: string;
  usage: string;
}

interface DesignSystemData {
  type: string;
  project_type: string;
  description: string;
  fonts: FontFamily[];
  palettes: PaletteColor[][];
  defaults: {
    heading_font: string;
    body_font: string;
    mono_font: string;
    heading_weight: number;
    body_weight: number;
    palette_index: number;
    border_radius: string;
    spacing_scale: string;
    style: string;
  };
}

// Google Fonts API
const GOOGLE_FONTS_API = "https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyBwIX97bVWr3-6AIUvGkcNnmFgirefZ6Sw&sort=popularity";

export function DesignSystemCard(props: { tool: ToolCall }) {
  const { submitDesignSystem } = useSDK();
  const [submitted, setSubmitted] = createSignal(false);
  
  // Font state
  const [headingFont, setHeadingFont] = createSignal("Inter");
  const [bodyFont, setBodyFont] = createSignal("Inter");
  const [monoFont, setMonoFont] = createSignal("JetBrains Mono");
  const [headingWeight, setHeadingWeight] = createSignal(600);
  const [bodyWeight, setBodyWeight] = createSignal(400);
  const [headingSize, setHeadingSize] = createSignal(32);
  const [bodySize, setBodySize] = createSignal(16);
  
  // Style state
  const [paletteIndex, setPaletteIndex] = createSignal(0);
  const [borderRadius, setBorderRadius] = createSignal("md");
  const [customColors, setCustomColors] = createSignal<PaletteColor[] | null>(null);
  
  // UI state
  const [activeFontPicker, setActiveFontPicker] = createSignal<"heading" | "body" | "mono" | null>(null);
  const [activeColorPicker, setActiveColorPicker] = createSignal<string | null>(null);
  const [fontSearch, setFontSearch] = createSignal("");
  const [googleFonts, setGoogleFonts] = createSignal<FontFamily[]>([]);
  const [loadedFonts, setLoadedFonts] = createSignal<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = createSignal(false);

  // Parse tool data
  const getData = (): DesignSystemData | null => {
    try {
      if (props.tool.metadata?.type === "design_system") {
        return props.tool.metadata as unknown as DesignSystemData;
      }
      if (props.tool.output) {
        const parsed = JSON.parse(props.tool.output);
        if (parsed.type === "design_system") return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const data = createMemo(() => getData());
  const palettes = createMemo(() => data()?.palettes || []);
  const basePalette = createMemo(() => palettes()[paletteIndex()] || []);
  const currentPalette = createMemo(() => customColors() || basePalette());
  const recommendedFonts = createMemo(() => data()?.fonts || []);

  // Update a single color in the palette
  const updateColor = (usage: string, hex: string) => {
    const current = customColors() || [...basePalette()];
    const updated = current.map(c => c.usage === usage ? { ...c, hex } : c);
    setCustomColors(updated);
  };

  // Reset to base palette when palette index changes
  createEffect(() => {
    paletteIndex(); // Track dependency
    setCustomColors(null);
  });

  // Combined fonts list (recommended + google search results)
  const allFonts = createMemo(() => {
    const search = fontSearch().toLowerCase();
    let fonts = [...recommendedFonts()];
    
    // Add Google Fonts
    if (googleFonts().length > 0) {
      fonts = [...fonts, ...googleFonts().filter(gf => 
        !fonts.some(f => f.name === gf.name)
      )];
    }
    
    // Filter by search
    if (search) {
      fonts = fonts.filter(f => f.name.toLowerCase().includes(search));
    }
    
    return fonts.slice(0, 50); // Limit results
  });

  // Fetch Google Fonts on mount
  onMount(async () => {
    try {
      const res = await fetch(GOOGLE_FONTS_API);
      const data = await res.json();
      if (data.items) {
        const fonts: FontFamily[] = data.items.slice(0, 200).map((item: any) => ({
          name: item.family,
          category: item.category,
          weights: (item.variants || [])
            .filter((v: string) => /^\d+$/.test(v) || v === "regular")
            .map((v: string) => ({
              value: v === "regular" ? 400 : parseInt(v),
              name: v === "regular" ? "Regular" : v
            }))
            .sort((a: FontWeight, b: FontWeight) => a.value - b.value),
          popular: false
        }));
        setGoogleFonts(fonts);
      }
    } catch (e) {
      console.error("Failed to fetch Google Fonts:", e);
    }
    
    // Load default fonts
    loadFont("Inter");
    loadFont("JetBrains Mono");
  });

  // Load a Google Font dynamically
  const loadFont = (fontName: string) => {
    if (loadedFonts().has(fontName)) return;
    
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    
    setLoadedFonts(prev => new Set([...prev, fontName]));
  };

  // Load font when selected
  createEffect(() => { loadFont(headingFont()); });
  createEffect(() => { loadFont(bodyFont()); });
  createEffect(() => { loadFont(monoFont()); });

  // Initialize with defaults
  createEffect(() => {
    const d = data();
    if (d?.defaults) {
      setHeadingFont(d.defaults.heading_font);
      setBodyFont(d.defaults.body_font);
      setMonoFont(d.defaults.mono_font);
      setHeadingWeight(d.defaults.heading_weight);
      setBodyWeight(d.defaults.body_weight);
      setPaletteIndex(d.defaults.palette_index);
      setBorderRadius(d.defaults.border_radius);
    }
  });

  const getColor = (usage: string) => currentPalette().find(c => c.usage === usage)?.hex || "#000";
  
  const getBorderRadius = () => {
    const map: Record<string, string> = { none: "0", sm: "4px", md: "8px", lg: "16px", full: "9999px" };
    return map[borderRadius()] || "8px";
  };

  const handleSubmit = () => {
    if (submitted()) return;
    setSubmitted(true);
    
    const config = {
      typography: {
        heading: { font: headingFont(), weight: headingWeight(), size: headingSize() },
        body: { font: bodyFont(), weight: bodyWeight(), size: bodySize() },
        mono: { font: monoFont() }
      },
      colors: currentPalette(),
      borderRadius: borderRadius(),
    };
    
    // Send the design system response via WebSocket
    // The call_id comes from the tool
    const callId = props.tool.id || "design_system";
    submitDesignSystem(callId, config);
  };

  const handleRandomize = () => {
    setIsGenerating(true);
    const sansSerif = allFonts().filter(f => f.category === "sans-serif");
    const randomFont = sansSerif[Math.floor(Math.random() * Math.min(sansSerif.length, 20))]?.name || "Inter";
    const randomPalette = Math.floor(Math.random() * palettes().length);
    
    setHeadingFont(randomFont);
    setBodyFont(randomFont);
    setPaletteIndex(randomPalette);
    loadFont(randomFont);
    
    setTimeout(() => setIsGenerating(false), 300);
  };

  // Font picker component
  const FontPicker = (pickerProps: { 
    type: "heading" | "body" | "mono",
    value: string,
    weight: number,
    size?: number,
    onSelect: (name: string) => void,
    onWeightChange: (w: number) => void,
    onSizeChange?: (s: number) => void
  }) => {
    const category = pickerProps.type === "mono" ? "monospace" : null;
    const filteredFonts = () => {
      let fonts = allFonts();
      if (category) fonts = fonts.filter(f => f.category === category);
      else fonts = fonts.filter(f => f.category !== "monospace");
      return fonts;
    };
    
    const selectedFont = () => allFonts().find(f => f.name === pickerProps.value);
    const weights = () => selectedFont()?.weights || [{ value: 400, name: "Regular" }];

    return (
      <Card 
        variant="elevated"
        padding="none"
        class="absolute top-full left-0 right-0 mt-1 z-50 overflow-hidden"
      >
        {/* Search */}
        <div class="p-2 border-b" style={{ "border-color": "var(--jb-border-default)" }}>
          <div class="relative">
            <Icon name="magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />
            <input
              type="text"
              value={fontSearch()}
              onInput={(e) => setFontSearch(e.currentTarget.value)}
              placeholder="Search fonts..."
              class="w-full pl-8 pr-3 py-1.5 rounded text-sm bg-transparent outline-none"
              style={{ 
                border: "1px solid var(--jb-border-default)", 
                color: "var(--jb-input-color)" 
              }}
            />
            <Show when={fontSearch()}>
              <IconButton 
                onClick={() => setFontSearch("")}
                size="sm"
                style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)" }}
              >
                <Icon name="xmark" class="w-3.5 h-3.5" />
              </IconButton>
            </Show>
          </div>
        </div>

        {/* Font list */}
        <div class="max-h-48 overflow-y-auto">
          <For each={filteredFonts()}>
            {(font) => (
              <button
                onClick={() => {
                  loadFont(font.name);
                  pickerProps.onSelect(font.name);
                }}
                class="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Text 
                  truncate
                  style={{ 
                    "font-family": `"${font.name}", ${font.category}`,
                    color: pickerProps.value === font.name ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)"
                  }}
                >
                  {font.name}
                </Text>
                <div class="flex items-center gap-1.5 shrink-0">
                  <Show when={font.popular}>
                    <Badge size="sm">★</Badge>
                  </Show>
                  <Show when={pickerProps.value === font.name}>
                    <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                  </Show>
                </div>
              </button>
            )}
          </For>
        </div>

        {/* Weight & Size controls */}
        <div class="p-3 border-t space-y-3" style={{ "border-color": "var(--jb-border-default)", background: "var(--jb-surface-active)" }}>
          {/* Weight */}
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <Text variant="muted" size="xs">Weight</Text>
              <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{pickerProps.weight}</Text>
            </div>
            <div class="flex flex-wrap gap-1">
              <For each={weights()}>
                {(w) => (
                  <button
                    onClick={() => pickerProps.onWeightChange(w.value)}
                    class="px-2 py-1 rounded text-xs transition-colors"
                    style={{ 
                      background: pickerProps.weight === w.value ? "var(--jb-text-body-color)" : "var(--ui-panel-bg)",
                      color: pickerProps.weight === w.value ? "var(--ui-panel-bg)" : "var(--jb-text-muted-color)",
                      "font-weight": w.value
                    }}
                  >
                    {w.value}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Size (only for heading/body) */}
          <Show when={pickerProps.onSizeChange && pickerProps.size !== undefined}>
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <Text variant="muted" size="xs">Size</Text>
                <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{pickerProps.size}px</Text>
              </div>
              <input
                type="range"
                min={pickerProps.type === "heading" ? 20 : 12}
                max={pickerProps.type === "heading" ? 64 : 24}
                value={pickerProps.size}
                onInput={(e) => pickerProps.onSizeChange!(parseInt(e.currentTarget.value))}
                class="w-full"
                style={{ "accent-color": "var(--jb-text-body-color)" }}
              />
            </div>
          </Show>
        </div>

        {/* Close button */}
        <button
          onClick={() => setActiveFontPicker(null)}
          class="w-full py-2 text-center border-t transition-colors"
          style={{ "border-color": "var(--jb-border-default)", background: "transparent" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <Text variant="muted" size="xs">Done</Text>
        </button>
      </Card>
    );
  };

  return (
    <Show when={data()} fallback={<Card padding="md"><Text variant="muted">Loading...</Text></Card>}>
      <Card variant="outlined" padding="none" class="overflow-hidden">
        {/* Header */}
        <div class="flex items-center gap-3 px-4 py-3 border-b" style={{ "border-color": "var(--jb-border-default)" }}>
          <Icon name="droplet" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
          <Text weight="medium">Design System</Text>
          <Badge>{data()?.project_type}</Badge>
          <div class="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRandomize}
            disabled={isGenerating()}
            icon={<Icon name="rotate" class={`w-3.5 h-3.5 ${isGenerating() ? "animate-spin" : ""}`} />}
          >
            Randomize
          </Button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: Controls */}
          <div class="p-4 space-y-5 border-b lg:border-b-0 lg:border-r" style={{ "border-color": "var(--jb-border-default)" }}>
            {/* Typography */}
            <div>
              <div class="flex items-center gap-1.5 mb-3">
                <Icon name="font" class="w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />
                <Text variant="muted" size="xs" weight="medium">Typography</Text>
              </div>
              
              {/* Heading Font */}
              <div class="relative mb-3">
                <div class="flex items-center justify-between mb-1">
                  <Text variant="muted" size="xs">Heading</Text>
                  <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{headingSize()}px</Text>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setActiveFontPicker(activeFontPicker() === "heading" ? null : "heading")}
                  style={{ 
                    width: "100%",
                    "justify-content": "space-between",
                    "font-family": `"${headingFont()}", sans-serif`,
                    "font-weight": headingWeight(),
                    "font-size": `${Math.min(headingSize(), 20)}px`,
                  }}
                >
                  <span class="truncate">{headingFont()}</span>
                  <Text variant="muted" size="xs">{headingWeight()}</Text>
                </Button>
                <Show when={activeFontPicker() === "heading"}>
                  <FontPicker 
                    type="heading"
                    value={headingFont()}
                    weight={headingWeight()}
                    size={headingSize()}
                    onSelect={setHeadingFont}
                    onWeightChange={setHeadingWeight}
                    onSizeChange={setHeadingSize}
                  />
                </Show>
              </div>

              {/* Body Font */}
              <div class="relative mb-3">
                <div class="flex items-center justify-between mb-1">
                  <Text variant="muted" size="xs">Body</Text>
                  <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{bodySize()}px</Text>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setActiveFontPicker(activeFontPicker() === "body" ? null : "body")}
                  style={{ 
                    width: "100%",
                    "justify-content": "space-between",
                    "font-family": `"${bodyFont()}", sans-serif`,
                    "font-weight": bodyWeight(),
                  }}
                >
                  <span class="truncate">{bodyFont()}</span>
                  <Text variant="muted" size="xs">{bodyWeight()}</Text>
                </Button>
                <Show when={activeFontPicker() === "body"}>
                  <FontPicker 
                    type="body"
                    value={bodyFont()}
                    weight={bodyWeight()}
                    size={bodySize()}
                    onSelect={setBodyFont}
                    onWeightChange={setBodyWeight}
                    onSizeChange={setBodySize}
                  />
                </Show>
              </div>

              {/* Mono Font */}
              <div class="relative">
                <Text variant="muted" size="xs" style={{ display: "block", "margin-bottom": "4px" }}>Code</Text>
                <Button
                  variant="secondary"
                  onClick={() => setActiveFontPicker(activeFontPicker() === "mono" ? null : "mono")}
                  style={{ 
                    width: "100%",
                    "font-family": `"${monoFont()}", monospace`,
                  }}
                >
                  {monoFont()}
                </Button>
                <Show when={activeFontPicker() === "mono"}>
                  <FontPicker 
                    type="mono"
                    value={monoFont()}
                    weight={400}
                    onSelect={setMonoFont}
                    onWeightChange={() => {}}
                  />
                </Show>
              </div>
            </div>

            {/* Colors */}
            <div>
              <div class="flex items-center gap-1.5 mb-3">
                <Icon name="droplet" class="w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />
                <Text variant="muted" size="xs" weight="medium">Color Palette</Text>
              </div>
              <div class="grid grid-cols-4 gap-2 mb-3">
                <For each={palettes()}>
                  {(palette, i) => {
                    const bg = palette.find(c => c.usage === "background")?.hex || "#fff";
                    const accent = palette.find(c => c.usage === "accent")?.hex || "#000";
                    const text = palette.find(c => c.usage === "text")?.hex || "#000";
                    return (
                      <button
                        onClick={() => setPaletteIndex(i())}
                        class="relative rounded-lg overflow-hidden aspect-[4/3] transition-transform hover:scale-105"
                        style={{ 
                          "border-width": "2px",
                          "border-style": "solid",
                          "border-color": paletteIndex() === i() ? "var(--jb-text-body-color)" : "transparent",
                          background: bg
                        }}
                      >
                        <div class="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: accent }} />
                        <div class="absolute top-1.5 left-1.5 w-2 h-2 rounded-full" style={{ background: text }} />
                      </button>
                    );
                  }}
                </For>
              </div>
              {/* Editable colors */}
              <div class="space-y-2">
                <For each={currentPalette()}>
                  {(color) => (
                    <div class="relative">
                      <button
                        onClick={() => setActiveColorPicker(activeColorPicker() === color.usage ? null : color.usage)}
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                        style={{ 
                          background: "var(--ui-panel-bg)", 
                          border: `1px solid ${activeColorPicker() === color.usage ? "var(--jb-text-muted-color)" : "var(--jb-border-default)"}` 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--jb-border-default)"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = activeColorPicker() === color.usage ? "var(--jb-text-muted-color)" : "var(--jb-border-default)"}
                      >
                        <div 
                          class="w-6 h-6 rounded"
                          style={{ background: color.hex, border: "1px solid var(--jb-border-default)" }}
                        />
                        <div class="flex-1 text-left">
                          <Text size="xs">{color.name}</Text>
                        </div>
                        <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{color.hex}</Text>
                      </button>
                      
                      {/* Color picker dropdown */}
                      <Show when={activeColorPicker() === color.usage}>
                        <Card 
                          variant="elevated"
                          padding="md"
                          class="absolute top-full left-0 right-0 mt-1 z-50"
                        >
                          <div class="flex gap-2 mb-2">
                            <input
                              type="color"
                              value={color.hex}
                              onInput={(e) => updateColor(color.usage, e.currentTarget.value)}
                              class="w-10 h-10 rounded cursor-pointer border-0 p-0"
                            />
                            <input
                              type="text"
                              value={color.hex}
                              onInput={(e) => {
                                const val = e.currentTarget.value;
                                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                  updateColor(color.usage, val);
                                }
                              }}
                              placeholder="var(--cortex-accent-text)"
                              class="flex-1 px-2 py-1 rounded font-mono text-sm"
                              style={{ 
                                background: "var(--jb-surface-active)", 
                                border: "1px solid var(--jb-border-default)", 
                                color: "var(--jb-text-body-color)" 
                              }}
                            />
                          </div>
                          {/* Quick presets */}
                          <div class="flex gap-1 flex-wrap">
                            <For each={["var(--cortex-accent-text)", "var(--cortex-text-primary)", "var(--cortex-text-primary)", "var(--cortex-bg-secondary)", "var(--cortex-bg-primary)", "var(--cortex-text-inactive)", "var(--cortex-info)", "var(--cortex-success)", "var(--cortex-error)", "var(--cortex-warning)"]}>
                              {(preset) => (
                                <button
                                  onClick={() => updateColor(color.usage, preset)}
                                  class="w-6 h-6 rounded transition-transform hover:scale-110"
                                  style={{ background: preset, border: "1px solid var(--jb-border-default)" }}
                                  title={preset}
                                />
                              )}
                            </For>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveColorPicker(null)}
                            style={{ width: "100%", "margin-top": "8px" }}
                          >
                            Done
                          </Button>
                        </Card>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Border Radius */}
            <div>
              <Text variant="muted" size="xs" style={{ display: "block", "margin-bottom": "8px" }}>Border Radius</Text>
              <div class="flex gap-1.5">
                <For each={["none", "sm", "md", "lg", "full"]}>
                  {(r) => (
                    <button
                      onClick={() => setBorderRadius(r)}
                      class="flex-1 py-2 rounded text-xs transition-colors"
                      style={{ 
                        background: borderRadius() === r ? "var(--jb-text-body-color)" : "var(--ui-panel-bg)",
                        color: borderRadius() === r ? "var(--ui-panel-bg)" : "var(--jb-text-muted-color)"
                      }}
                    >
                      {r}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div class="p-4">
            <Text variant="muted" size="xs" weight="medium" style={{ display: "block", "margin-bottom": "12px" }}>Live Preview</Text>
            <div 
              class="rounded-xl overflow-hidden shadow-lg"
              style={{ 
                background: getColor("background"),
                border: `1px solid ${getColor("border")}`
              }}
            >
              {/* Nav */}
              <div 
                class="flex items-center justify-between px-4 py-3"
                style={{ background: getColor("surface"), "border-bottom": `1px solid ${getColor("border")}` }}
              >
                <span style={{ 
                  "font-family": `"${headingFont()}", sans-serif`,
                  "font-weight": headingWeight(),
                  "font-size": "16px",
                  color: getColor("text")
                }}>
                  Brand
                </span>
                <div class="flex gap-4" style={{ "font-family": `"${bodyFont()}", sans-serif`, "font-weight": bodyWeight() }}>
                  <span class="text-xs" style={{ color: getColor("text-muted") }}>Features</span>
                  <span class="text-xs" style={{ color: getColor("text-muted") }}>Pricing</span>
                </div>
              </div>

              {/* Hero */}
              <div class="px-4 py-8 text-center">
                <h1 style={{ 
                  "font-family": `"${headingFont()}", sans-serif`,
                  "font-weight": headingWeight(),
                  "font-size": `${headingSize()}px`,
                  "line-height": 1.2,
                  color: getColor("text"),
                  "margin-bottom": "12px"
                }}>
                  Beautiful Design
                </h1>
                <p style={{ 
                  "font-family": `"${bodyFont()}", sans-serif`,
                  "font-weight": bodyWeight(),
                  "font-size": `${bodySize()}px`,
                  "line-height": 1.5,
                  color: getColor("text-muted"),
                  "max-width": "300px",
                  margin: "0 auto 20px"
                }}>
                  Create stunning websites with a minimal, cohesive design system.
                </p>
                <button style={{ 
                  background: getColor("accent"),
                  color: getColor("background"),
                  padding: "10px 20px",
                  "border-radius": getBorderRadius(),
                  "font-family": `"${bodyFont()}", sans-serif`,
                  "font-weight": 500,
                  "font-size": "14px",
                  border: "none",
                  cursor: "pointer"
                }}>
                  Get Started
                </button>
              </div>

              {/* Cards */}
              <div class="px-4 pb-4 grid grid-cols-2 gap-3">
                <For each={["Feature One", "Feature Two"]}>
                  {(title) => (
                    <div style={{ 
                      background: getColor("surface"),
                      "border-radius": getBorderRadius(),
                      border: `1px solid ${getColor("border")}`,
                      padding: "12px"
                    }}>
                      <div style={{ 
                        "font-family": `"${headingFont()}", sans-serif`,
                        "font-weight": Math.max(headingWeight() - 100, 400),
                        "font-size": "14px",
                        color: getColor("text"),
                        "margin-bottom": "4px"
                      }}>
                        {title}
                      </div>
                      <div style={{ 
                        "font-family": `"${bodyFont()}", sans-serif`,
                        "font-weight": bodyWeight(),
                        "font-size": "12px",
                        color: getColor("text-muted")
                      }}>
                        Description text here
                      </div>
                    </div>
                  )}
                </For>
              </div>

              {/* Code */}
              <div 
                class="mx-4 mb-4 p-3 text-xs"
                style={{ 
                  background: getColor("text"),
                  color: getColor("background"),
                  "font-family": `"${monoFont()}", monospace`,
                  "border-radius": getBorderRadius()
                }}
              >
                <span style={{ opacity: 0.6 }}>const</span> theme = <span style={{ color: getColor("accent") }}>"minimal"</span>;
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between px-4 py-3 border-t" style={{ "border-color": "var(--jb-border-default)" }}>
          <Text variant="muted" size="xs">
            Select your design preferences, then click Apply
          </Text>
          <Show 
            when={!submitted()}
            fallback={
              <div class="flex items-center gap-2">
                <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                <Text variant="muted" size="sm">Applied</Text>
              </div>
            }
          >
            <Button
              variant="primary"
              onClick={handleSubmit}
              icon={<Icon name="paper-plane" class="w-4 h-4" />}
            >
              Apply Design System
            </Button>
          </Show>
        </div>
      </Card>
    </Show>
  );
}


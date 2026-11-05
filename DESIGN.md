# Toolzy design guide

Toolzy is a workbench, not a website. People arrive with a task (format this, decode that), do it in seconds and leave. Every screen should feel like an instrument: dense, predictable, quiet, and fast. Read this before changing any UI. Update it when a rule changes.

## 1. Principles

1. **Tool first.** The input and the result are the page. Marketing copy, big hero text and decoration are not. Long text lives in a collapsed `AboutTool`.
2. **One shape for every tool.** Same header, same spacing, same controls, same states. Learning one tool teaches all of them.
3. **Quiet chrome, loud results.** Controls are neutral. Colour is reserved for state: the single primary action, a selected option, success, warning, danger.
4. **Every control answers back.** Hover, focus, pressed, selected, disabled and busy each look different and are never colour-only.
5. **Dense, not cramped.** Compact controls (32 px), generous grouping (16 to 24 px between groups), clear labels.
6. **Local and honest.** Privacy is shown once, small, in the header. Anything a tool cannot prove (for example "valid signature" is not "trusted signer") is stated plainly next to the result.
7. **Keyboard and touch both work.** Visible focus everywhere, 36 px minimum touch height on small screens, no hover-only features.

## 2. Page anatomy

```
┌ sidebar ┬ top bar (sticky, 44 px): sidebar toggle · tool name ·············
│         ├──────────────────────────────────────────────────────────────
│         │  ToolHeader   [icon] Title        description          [actions] [Local chip]
│         │  ───────────────────────────────────────────────────────────
│         │  toolbar / tabs   (one row, wraps on small screens)
│         │  workspace        (input | output panels, or a single column)
│         │  secondary panels (history, help, reference) below the workspace
└─────────┴──────────────────────────────────────────────────────────────
```

- **Always use `ToolPageLayout`** (`src/components/ToolPageLayout.tsx`). It renders `ToolHeader`, applies the content width and the vertical rhythm. Pages must not render their own `<h1>`.
- **Widths** (`width` prop, defined in `src/lib/toolLayout.ts` as `toolPageClass(width)`): `fluid` (default) fills the available width and is left-aligned, never centred; use it for every tool with an editor, table or two-panel workspace. `wide` caps at 1440 px for form-heavy tools on very large screens. `narrow` (`max-w-3xl`) is only for single-column reading or small forms. Do not pick a width to make a page look balanced: unused space on the right is better than a cramped workspace. Pages that manage their own layout (Markdown, Encoding Hub) use `w-full max-w-none`.
- **Page padding** is owned by `AppLayout`: `p-3` on phones, `sm:p-4`, `lg:p-5`. Pages do not add outer padding, and never wrap content in `mx-auto` or extra `container` padding.
- **Workspace height:** input/output panels fill the viewport instead of using a fixed pixel height: `h-[clamp(min,calc(100dvh-offset),max)]`. With `ResizablePanelGroup`, put the clamp on a wrapper `div` and give the group `h-full` (the group sets an inline height and ignores a clamp class).
- **Long explanatory text** (format guides, SEO copy) goes into `AboutTool`, a collapsed `<details>` under the workspace. It stays in the DOM for search engines and never pushes the tool down.
- **Header content:** title (one line, `text-base font-semibold`), optional one-line description (`text-xs text-muted-foreground`, no marketing tone), optional `actions` (right side) and the privacy chip (right side). Title and description wrap, never truncate.
- **Privacy chip:** one small `Local only` chip with a shield icon and a tooltip: "Runs in your browser. Nothing is uploaded." Do not repeat it elsewhere on the page except where a tool has a specific storage or network behaviour to disclose.

## 3. Spacing and layout

Scale (Tailwind units): 1 (4 px), 2 (8 px), 3 (12 px), 4 (16 px), 6 (24 px). Do not use odd one-off values.

| Where | Value |
| --- | --- |
| Between page sections | `space-y-4` (16 px), applied by `toolPageClass` / `ToolPageLayout` |
| Between controls in a group | `gap-2` (8 px); `gap-3` for form fields |
| Label to control | `space-y-1.5` (6 px) |
| Inside cards and panels | `p-4` (16 px); `p-3` for dense toolbars |
| Toolbar padding | `p-2`, buttons `gap-1.5` |
| Panel headings | `text-xs uppercase tracking-wider text-muted-foreground` |

Rules: group related controls in one bordered surface instead of floating them; put the primary action next to the input it acts on; keep result actions (copy, download) in the result panel header; two-column layouts collapse to one column below `lg`; nothing may cause horizontal page scroll at 390 px.

## 4. Colour and surfaces

Tokens live in `src/index.css` (HSL custom properties). Use tokens, never raw colours.

- **Surfaces:** `background` (page) < `card` (panels) < `secondary` (raised or hovered controls). Borders are `border`. A surface never sits on the same tone as its parent.
- **Primary (cyan)** means "do this" or "this is selected". At most one filled primary button per view. Selected options use the tinted `selected` style, not the filled primary, so they cannot be confused with the call to action.
- **Status:** `success`, `warning`, `destructive`, `info`, always paired with an icon or text, in the shared tinted style (`bg-x/10 border-x/30 text-x`).
- **Text:** `foreground` for content, `muted-foreground` for labels and help. Muted text must stay readable (about 4.5:1 on its surface); do not dim it further with opacity.
- Dark theme is the only theme. Keep tokens ready for a light theme but do not ship one-off light styles.

## 5. Typography

- UI text uses the system sans stack; **data, code, keys, hashes and titles** use JetBrains Mono (`font-mono`).
- Sizes: title `text-base`, body `text-sm`, labels and help `text-xs`, code `text-xs` (`text-[13px]` in editors). Minimum 12 px. No `text-[10px]` for anything a person must read.
- Labels are sentence case; the uppercase style is only for panel headings.

## 6. Controls and states

All interactive controls share one state model. Implemented in `ui/button.tsx`, `ui/tabs.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/toggle*.tsx` and `index.css`.

| State | Treatment |
| --- | --- |
| Rest | Neutral surface, 1 px border for outline controls |
| Hover | One step lighter surface (`secondary` to `secondary/70`), border brightens; filled primary darkens slightly. Cursor stays default except on links and drag handles. 120 ms ease |
| Focus-visible | 2 px `ring` outline with 2 px offset; never removed |
| Pressed | `active:translate-y-px` and one step darker surface |
| Selected | `selected` variant: `bg-primary/15 text-primary border-primary/40`; also sets `aria-pressed` or `data-state` |
| Disabled | 50 % opacity, `cursor-not-allowed`, no hover effect, and a visible reason when it is not obvious |
| Busy | Spinner replaces the icon, label changes to present tense ("Signing…"), control disabled, a Cancel control when the job can be cancelled |
| Error | Destructive border and a message under the field (`role="alert"`), never only a toast |

**Button sizes:** `sm` 32 px (default for toolbars and tool bodies), `default` 36 px, `lg` 40 px (rare), `icon` 32 px square with an `aria-label` and a tooltip. From the `sm` breakpoint down, hit areas grow to 36 px.

**Hierarchy per view:** one `default` (primary) button; `secondary` or `outline` for the rest; `ghost` for tertiary and icon actions; `destructive` only for irreversible actions, always behind a confirm dialog when data would be lost.

**Segmented controls and tabs** (`Tabs`, option groups): the active item is raised (`background`) with a visible border; inactive items brighten on hover. Use tabs for different tasks within a tool and a segmented group for a mode of the same task.

**Inputs:** 36 px high, `bg-card`, border brightens on hover, ring on focus, placeholder in `muted-foreground`. Textareas for code use `font-mono text-xs` and `resize-y`.

**Feedback:** use `sonner` toasts for completed actions (copied, downloaded, saved) and inline messages for anything the person must act on or can reproduce. Copy and download buttons confirm with a toast and, where space allows, a 1.5 s check icon.

**Empty states:** dashed border panel, one sentence saying what to do, optionally one example action ("Load sample"). Never a blank panel.

## 7. Motion

Only short, functional transitions: colour and border at 120 ms, panel open/close at 150 ms, no entrance animation on page load, no parallax. Everything is disabled under `prefers-reduced-motion` (handled globally in `index.css`).

## 8. Home page (launcher)

The home page is a launcher, not a landing page: compact heading, a search box focused on load (press `/` anywhere to focus it), a dense grid of tool tiles with hover and focus states, and nothing else above the fold. Tiles show icon, name and one short line. Tiles are links (keyboard reachable), not nested buttons.

## 9. Accessibility checklist

- Every control has an accessible name; icon-only buttons have `aria-label`.
- Visible focus ring on every interactive element; logical tab order.
- Status is never colour-only; live results use `role="status"` and errors `role="alert"`.
- Contrast: body and muted text at least 4.5:1 on their surface, UI boundaries 3:1.
- Works at 390 px wide with no horizontal scroll, and at 200 % zoom.
- Dialogs trap focus and restore it (Radix handles this; do not replace them with custom modals).

## 10. Implementation map

| Concern | File |
| --- | --- |
| Tokens, global focus, motion, scrollbars | `src/index.css`, `tailwind.config.ts` |
| Shell: sidebar, sticky top bar, padding | `src/components/AppLayout.tsx`, `AppSidebar.tsx` |
| Page header and rhythm | `src/components/ToolHeader.tsx`, `ToolPageLayout.tsx`, `src/lib/toolLayout.ts` |
| Collapsed long text | `src/components/AboutTool.tsx` |
| Privacy chip | `src/components/json-formatter/PrivacyBadge.tsx` |
| Buttons, tabs, inputs | `src/components/ui/*` |
| Status colours | `src/components/document-signer/statusStyles.ts` (move to `src/lib` when reused more widely) |
| Launcher | `src/pages/Index.tsx` |

## 11. Adding or changing a tool

1. Wrap the page in `ToolPageLayout` with a title, a one-line description and (rarely) a `width`. Check the page at 1920 px: the workspace should use the width and height, with no large empty bands.
2. Compose from the shared controls; do not restyle them per tool. If a new pattern is needed in two places, add it to `ui/` and document it here.
3. Check every state in section 6 (hover, focus, pressed, selected, disabled, busy, error, empty) and the 390 px layout.
4. Run the page in the browser, take a screenshot at 1280 px and 390 px, and compare it with a sibling tool for header, spacing and control size.
5. Keep the end-to-end checks passing (`README.md` lists the validation record).

## 12. Rollout plan

1. **Foundation:** tokens, motion, focus; `Button`, `Tabs`, `Input`, `Textarea` states; `selected` variant.
2. **Shell:** sticky top bar with tool name, responsive padding, sidebar hover and active states.
3. **Header:** `ToolHeader` and `ToolPageLayout` v2; migrate every page off hand-written `<h1>` blocks.
4. **Selection controls:** switch filled-primary "selected" buttons to the `selected` variant.
5. **Launcher:** compact home page with focus-on-load search and `/` shortcut.
6. **Verify:** screenshots before and after at 1280 and 390 px, hover and focus captures, unit tests, build, end-to-end run.
7. **Density pass (done):** fluid left-aligned pages, tighter padding and 16 px rhythm, viewport-filling panels, `AboutTool` for long copy, 1920 px and 390 px audits.
8. **Later:** a light theme, a command palette (Ctrl/Cmd+K), per-tool keyboard shortcut hints, shared `ResultPanel` and `CopyButton` components.

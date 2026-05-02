# Hyperlinks — Working with Hyperlinks in PowerPoint

Hyperlinks in PowerPoint can be attached to a `Shape` (the entire shape is clickable) or to a
`TextRange` (a specific run of text is clickable). Both entry points live behind
`PowerPoint.HyperlinkAddOptions` and return a `PowerPoint.Hyperlink` object.

The slide-level `slide.hyperlinks` collection (`HyperlinkCollection`) aggregates every hyperlink on
that slide, regardless of whether it is shape-level or text-level.

---

## Key Types

- **`PowerPoint.Hyperlink`** — a single hyperlink with properties:
  - `address: string` — URL, file path, or `mailto:` URI (PowerPointApi 1.6)
  - `screenTip: string` — tooltip text shown on hover (PowerPointApi 1.6)
  - `readonly type: PowerPoint.HyperlinkType | "TextRange" | "Shape"` — which object it is attached to (PowerPointApi 1.10)
  - `delete()` — removes the hyperlink (PowerPointApi 1.10)
  - `getLinkedShapeOrNullObject()` — resolves back to the `Shape` if type is `"Shape"` (PowerPointApi 1.10)
  - `getLinkedTextRangeOrNullObject()` — resolves back to the `TextRange` if type is `"TextRange"` (PowerPointApi 1.10)
- **`PowerPoint.HyperlinkType`** enum members (PowerPointApi 1.10):
  - `textRange = "TextRange"` — hyperlink is on a `TextRange`
  - `shape = "Shape"` — hyperlink is on a whole `Shape`
- **`PowerPoint.HyperlinkCollection`** (`slide.hyperlinks`) — all hyperlinks on a slide.
  Methods: `add(target, options?)`, `getCount()`, `getItemAt(index)`, `load(...)`.
- **`PowerPoint.HyperlinkScopedCollection`** (`textRange.hyperlinks`) — hyperlinks within a specific `TextRange`.
  Methods: `getCount()`, `getItemAt(index)`, `load(...)`. **Note: `add()` is NOT available on the scoped collection.**
  To add a hyperlink to a `TextRange`, call `textRange.setHyperlink(options?)` instead (PowerPointApi 1.10).
- **`PowerPoint.HyperlinkAddOptions`** — `{ address?: string; screenTip?: string }`.
- **`Shape.setHyperlink(options?)` → `PowerPoint.Hyperlink`** — sets a hyperlink on the whole shape; deletes any existing shape hyperlink (PowerPointApi 1.10).
- **`TextRange.setHyperlink(options?)` → `PowerPoint.Hyperlink`** — sets a hyperlink on the text range; deletes all existing hyperlinks on that range (PowerPointApi 1.10).

---

## Adding a Hyperlink to a Shape

The simplest way to make an entire shape clickable: call `shape.setHyperlink(options)`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name");
  await context.sync();

  // Find a shape by name and attach a URL hyperlink to it.
  const target = shapes.items.find(s => s.name === "ClickMeButton");
  if (!target) {
    console.log("Shape not found.");
    return;
  }

  const liveShape = slide.shapes.getItem(target.id);
  const hyperlink = liveShape.setHyperlink({
    address: "https://www.contoso.com",
    screenTip: "Visit Contoso",
  });
  await context.sync();
  console.log("Hyperlink set on shape.");
});
```

---

## Adding a Hyperlink to a Text Range

To make a substring of text clickable, get the `TextRange` first, then call `setHyperlink`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type");
  await context.sync();

  const textBox = shapes.items.find(s => s.name === "BodyText");
  if (!textBox) return;

  const textFrame = slide.shapes.getItem(textBox.id).textFrame;
  // Get a substring (characters 0–11 inclusive).
  const sub = textFrame.textRange.getSubstring(0, 12);
  sub.setHyperlink({
    address: "https://www.example.com",
    screenTip: "Open example.com",
  });
  await context.sync();
  console.log("Text-range hyperlink set.");
});
```

---

## Reading All Hyperlinks on a Slide

`slide.hyperlinks` is the flat collection of all hyperlinks on a slide.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const links = slide.hyperlinks;
  links.load("items/address, items/screenTip, items/type");
  await context.sync();

  if (links.items.length === 0) {
    console.log("No hyperlinks on this slide.");
    return;
  }

  for (const link of links.items) {
    console.log(`[${link.type}] ${link.address}  (tip: ${link.screenTip})`);
  }
});
```

---

## Deleting a Hyperlink

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const links = slide.hyperlinks;
  links.load("items/address, items/type");
  await context.sync();

  // Delete the first shape-level hyperlink found.
  const shapeLink = links.items.find(l => l.type === "Shape");
  if (shapeLink) {
    slide.hyperlinks.getItemAt(links.items.indexOf(shapeLink)).delete();
    await context.sync();
    console.log("Shape hyperlink deleted.");
  }
});
```

---

## Common Mistakes

- **Using `slide.hyperlinks.add(target, options)` without passing a live proxy**: The `target` argument must be a `PowerPoint.TextRange` or `PowerPoint.Shape` object (not an id string). Prefer `shape.setHyperlink(options)` and `textRange.setHyperlink(options)` instead — they are simpler and more direct.
- **Assuming `HyperlinkType` strings are different**: The enum values are `"TextRange"` and `"Shape"` (camelCase `textRange` / `shape` as JS enum keys, but the string values are PascalCase). Use `link.type === "Shape"` in comparisons.
- **Skipping `load` before reading hyperlink properties**: `address`, `screenTip`, and `type` are proxy properties — always `load("items/address, items/screenTip, items/type")` and `await context.sync()` before reading them.
- **Expecting `setHyperlink` to accumulate multiple hyperlinks on one shape**: It replaces any existing shape-level hyperlink. For multiple clickable areas use separate shapes or separate text-range hyperlinks.
- **Confusing `HyperlinkCollection` (slide-level) with `HyperlinkScopedCollection` (textRange-level)**: Both expose `items`, `getCount()`, and `getItemAt()` but the scoped variant only holds hyperlinks within that text range. See `textRange.hyperlinks` to inspect per-range links.
- **Equating PowerPoint and Word/Excel hyperlink APIs**: `Word.Hyperlink` and `Excel` shapes have different signatures. Always use the PowerPoint namespace and `HyperlinkAddOptions`.

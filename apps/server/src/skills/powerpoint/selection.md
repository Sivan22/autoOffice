# Selection — Reading and Setting the User Selection in PowerPoint

PowerPoint exposes the current user selection through four read methods and two programmatic-select
methods on `context.presentation`. These APIs are useful for commands that should "operate on what
the user has selected" without requiring the user to provide an explicit target.

---

## Key Types

- **`presentation.getSelectedSlides() → SlideScopedCollection`** — slides currently selected in the panel. Returns an empty collection when no slides are selected (PowerPointApi 1.5).
- **`presentation.getSelectedShapes() → ShapeScopedCollection`** — shapes selected in the editing area of the current slide. Returns an empty collection when no shapes are selected (PowerPointApi 1.5).
- **`presentation.getSelectedTextRange() → TextRange`** — the text cursor or selection in the current view. **Throws** if no text is selected — wrap in try/catch or use the null-object variant (PowerPointApi 1.5).
- **`presentation.getSelectedTextRangeOrNullObject() → TextRange`** — same as above but returns an object with `isNullObject = true` when no text is selected. Preferred over the throwing variant (PowerPointApi 1.5).
- **`presentation.setSelectedSlides(slideIds: string[]) → void`** — programmatically replace the slide selection. Pass an empty array to clear (PowerPointApi 1.5).
- **`slide.setSelectedShapes(shapeIds: string[]) → void`** — programmatically replace the shape selection within that slide (PowerPointApi 1.5).

> `SlideScopedCollection` and `ShapeScopedCollection` are *scoped* collections. They support the
> same `load`, `getCount()`, `getItem(key)`, and `getItemAt(index)` patterns as their non-scoped
> counterparts but are distinct types — you cannot pass one where the other is expected.

---

## Bolding the Currently Selected Text

Use `getSelectedTextRangeOrNullObject` to safely operate on selected text.

```javascript
await PowerPoint.run(async (context) => {
  const textRange = context.presentation.getSelectedTextRangeOrNullObject();
  textRange.load("text");
  await context.sync();

  if (textRange.isNullObject) {
    console.log("No text selected — nothing to bold.");
    return;
  }

  textRange.font.bold = true;
  await context.sync();
  console.log(`Bolded: "${textRange.text}"`);
});
```

---

## Deleting All Currently Selected Shapes

```javascript
await PowerPoint.run(async (context) => {
  const pres = context.presentation;
  const selectedShapes = pres.getSelectedShapes();
  selectedShapes.load("items/id");
  await context.sync();

  if (selectedShapes.items.length === 0) {
    console.log("No shapes selected.");
    return;
  }

  // Get the active slide (the first item in getSelectedSlides()).
  const activeSlide = pres.getSelectedSlides().getItemAt(0);
  for (const s of selectedShapes.items) {
    activeSlide.shapes.getItem(s.id).delete();
  }
  await context.sync();
  console.log(`Deleted ${selectedShapes.items.length} shape(s).`);
});
```

> Note: Selected shapes belong to the **active slide** — the slide visible in the editing area.
> Retrieve it via `presentation.getSelectedSlides().getItemAt(0)` (the first item in the
> collection is always the active slide). Use the shape `id` to look them up in
> `activeSlide.shapes.getItem(id)`.

---

## Programmatically Selecting a Slide

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  if (slides.items.length < 2) {
    console.log("Not enough slides.");
    return;
  }

  // Select the second slide (index 1).
  context.presentation.setSelectedSlides([slides.items[1].id]);
  await context.sync();
  console.log("Second slide selected.");
});
```

---

## Reading the Selected Slides

```javascript
await PowerPoint.run(async (context) => {
  const selected = context.presentation.getSelectedSlides();
  selected.load("items/id");
  await context.sync();

  if (selected.items.length === 0) {
    console.log("No slides selected.");
  } else {
    console.log("Selected slide IDs:", selected.items.map(s => s.id).join(", "));
  }
});
```

---

## "Operate on What the User Selected" Pattern

Attempt text-range first; fall back to selected shapes' text frames.

```javascript
await PowerPoint.run(async (context) => {
  const pres = context.presentation;

  // 1. Try text-range selection.
  const textRange = pres.getSelectedTextRangeOrNullObject();
  textRange.load("text");
  await context.sync();

  if (!textRange.isNullObject) {
    textRange.font.color = "#C00000";  // Red
    await context.sync();
    console.log("Applied to selected text.");
    return;
  }

  // 2. Fall back to selected shapes.
  const selectedShapes = pres.getSelectedShapes();
  selectedShapes.load("items/id");
  await context.sync();

  if (selectedShapes.items.length === 0) {
    console.log("Nothing selected.");
    return;
  }

  const activeSlide = pres.getSelectedSlides().getItemAt(0);
  for (const s of selectedShapes.items) {
    const liveShape = activeSlide.shapes.getItem(s.id);
    liveShape.textFrame.textRange.font.color = "#C00000";
  }
  await context.sync();
  console.log(`Applied to ${selectedShapes.items.length} shape text frame(s).`);
});
```

---

## Common Mistakes

- **Using `getSelectedTextRange()` without try/catch**: This variant throws when no text is selected. Use `getSelectedTextRangeOrNullObject()` and check `isNullObject` instead.
- **Assuming scoped collections equal the full collection**: `ShapeScopedCollection` is not a `ShapeCollection` and `SlideScopedCollection` is not a `SlideCollection`. They are distinct types and cannot be used interchangeably.
- **Modifying scoped-collection items without sync**: Changes to shapes retrieved via `getSelectedShapes()` follow the same load-sync rules as any proxy object — set properties, then `await context.sync()`.
- **Assuming `getSelectedSlides()` returns more than one slide**: In Normal view only the active slide is typically selected. In Slide Sorter the user can select multiple. Always check `items.length`.
- **Forgetting that `setSelectedSlides([])` clears the selection**: An empty array is valid and results in no slide being highlighted.
- **Using `slide.setSelectedShapes` on the wrong slide**: `setSelectedShapes` is a method on a `Slide` object. Call it on the slide that actually contains those shapes; calling it on a different slide's proxy is a logic error.

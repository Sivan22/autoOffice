# Slides — Slide Collection and Per-Slide Operations

`presentation.slides` is a `SlideCollection` containing all slides in deck order. You can iterate, inspect, reorder, delete, and export individual slides. New slides are added via `slides.add(options?)` (typed API) or via `presentation.insertSlidesFromBase64(...)` for OOXML round-trips.

## Key Types

- `PowerPoint.SlideCollection` — `presentation.slides`. Methods: `add(options?)`, `getItem(id)`, `getItemAt(index)`, `getItemOrNullObject(id)`, `getCount()`, `exportAsBase64Presentation(values)`, `load(...)`.
- `PowerPoint.Slide` — single slide proxy. Properties: `id` (string), `index` (number, 0-based), `layout`, `slideMaster`, `shapes`, `tags`, `hyperlinks`, `customXmlParts`, `background`, `themeColorScheme`. Methods: `applyLayout(slideLayout)`, `delete()`, `exportAsBase64()`, `getImageAsBase64(options?)`, `moveTo(slideIndex)`, `setSelectedShapes(shapeIds)`.
- `PowerPoint.ShapeCollection` — `slide.shapes`. All shapes on a slide. See the `shapes` skill.
- `PowerPoint.TagCollection` — `slide.tags`. Key-value metadata on a slide. See the `tags` skill.

## Slide Identity

Each slide has a string `id` assigned by the runtime — it is stable and is the canonical way to reference a specific slide with `getItem(id)` or `getItemOrNullObject(id)`. The `index` property (PowerPointApi 1.8) returns the 0-based position in the collection; this changes when slides are reordered.

## Accessing Slides

### By Index (0-based)

`getItemAt(index)` is **0-based**. The first slide in the UI is at index `0`.

```javascript
await PowerPoint.run(async (context) => {
  const firstSlide = context.presentation.slides.getItemAt(0);
  firstSlide.load("id, index");
  await context.sync();

  console.log("First slide id:", firstSlide.id, "index:", firstSlide.index);
});
```

### By ID

Use `getItemOrNullObject(id)` when you have a slide ID from a prior sync. Always check `isNullObject` before using the result.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemOrNullObject("slide-id-string");
  slide.load("id");
  await context.sync();

  if (slide.isNullObject) {
    console.log("Slide not found.");
  } else {
    console.log("Found slide:", slide.id);
  }
});
```

## Iterate All Slides — Log ID, Index, and Shape Count

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id, items/index");
  await context.sync();

  // Load shape counts for all slides in one batch.
  slides.items.forEach((slide) => slide.shapes.load("items/id"));
  await context.sync();

  slides.items.forEach((slide) => {
    console.log(`Slide index=${slide.index}, id=${slide.id}, shapes=${slide.shapes.items.length}`);
  });
});
```

## Add a New Slide

`slides.add(options?)` adds a new slide (PowerPointApi 1.3) and returns `void`. To work with the new slide, re-query the collection after sync.

- When neither `slideMasterId` nor `layoutId` is provided, the runtime selects the master from the previous slide; the specific layout chosen for the new slide is not documented in the types — verify with a `slides.load("items/layout")` round-trip if you need to know.
- If only `layoutId` is provided, the specified layout must be available under the default master (the previous slide's master, or the presentation's first master if there is no previous slide).
- If both are provided, the layout must belong to the specified master.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  // Add a slide using the default master and layout.
  slides.add();
  await context.sync();

  // Re-query to see the newly added slide.
  slides.load("items/id");
  await context.sync();
  console.log("Slide count after add:", slides.items.length);
});
```

To add a slide with a specific master and layout:

```javascript
await PowerPoint.run(async (context) => {
  const masters = context.presentation.slideMasters;
  masters.load("items/id");
  await context.sync();

  const master = masters.getItemAt(0);
  master.layouts.load("items/id, items/name");
  await context.sync();

  const layout = master.layouts.items.find((l) => l.name === "Title and Content");

  if (layout) {
    context.presentation.slides.add({
      slideMasterId: master.id,
      layoutId: layout.id,
    });
    await context.sync();
    console.log("Slide added with specified layout.");
  }
});
```

## Delete a Slide

`slide.delete()` removes the slide from the deck. Call `context.sync()` to commit.

```javascript
await PowerPoint.run(async (context) => {
  // Delete the third slide (0-based index 2).
  const slide = context.presentation.slides.getItemAt(2);
  slide.delete();
  await context.sync();
});
```

## Move a Slide to a New Position

`moveTo(slideIndex)` places the slide at the given 0-based position. Other slides shift to accommodate.

```javascript
await PowerPoint.run(async (context) => {
  // Move the last slide to the front.
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  const last = slides.getItemAt(slides.items.length - 1);
  last.moveTo(0);
  await context.sync();
});
```

## Copy a Slide to the End (exportAsBase64 + insertSlidesFromBase64)

There is no `slide.duplicate()` method. To copy a slide, export it as a self-contained `.pptx` via `exportAsBase64()`, then re-insert via `presentation.insertSlidesFromBase64(...)`. See the `ooxml` skill for full round-trip patterns.

```javascript
await PowerPoint.run(async (context) => {
  // Export the first slide as a base64 .pptx.
  const slide = context.presentation.slides.getItemAt(0);
  const result = slide.exportAsBase64();
  await context.sync();

  // result.value is now a base64-encoded single-slide .pptx.
  const base64 = result.value;

  // Insert it back — this appends the copied slide to the end by default.
  context.presentation.insertSlidesFromBase64(base64, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });
  await context.sync();

  console.log("Slide copied to end.");
});
```

## Export a Slide as Base64

`slide.exportAsBase64()` returns a `ClientResult<string>`. Read `.value` only after `await context.sync()`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const result = slide.exportAsBase64();
  await context.sync();

  const base64 = result.value; // Complete .pptx containing this one slide.
  console.log("Exported slide, base64 length:", base64.length);
});
```

## Per-Slide Layout and Master

`slide.layout` is the `SlideLayout` applied to this slide; `slide.slideMaster` is the `SlideMaster`. Both are proxy objects that require `load()` before reading their properties. Use `slide.applyLayout(slideLayout)` (PowerPointApi 1.8) to change the layout — see the `slide-layouts` skill.

## Common Mistakes

- **Calling `slide.duplicate()`** — this method does not exist. Copy a slide via `exportAsBase64()` + `insertSlidesFromBase64(...)`. See the `ooxml` skill.
- **Treating `getItemAt` index as 1-based** — it is **0-based**. Slide 1 in the UI is `getItemAt(0)`.
- **Assuming `slides.add()` returns the new slide** — it returns `void`. Re-query the collection after sync to access the new slide.
- **Not loading the collection before reading `items.length`** — call `slides.load("items/id")` and sync before checking `slides.items.length`.
- **Calling `exportAsBase64()` and reading `.value` before sync** — `exportAsBase64()` returns a `ClientResult<string>`. The `.value` is only populated after `await context.sync()`.
- **Deleting a slide while iterating `slides.items`** — mutating the collection during iteration produces unexpected results. Collect the slides to delete first, then call `delete()` in a separate pass.
- **Passing a layout from a different master to `slides.add({ layoutId })`** — if `layoutId` belongs to a master other than the default (and `slideMasterId` is not specified), the call throws. Specify both `slideMasterId` and `layoutId` together.

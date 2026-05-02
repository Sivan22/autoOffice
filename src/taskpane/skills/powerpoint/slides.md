# Slides — Slide Collection and Per-Slide Operations

`presentation.slides` is a `SlideCollection` containing all slides in deck order. You can iterate, inspect, reorder, duplicate, delete, and export individual slides. Adding new slides requires an OOXML round-trip — there is no `slides.add()` method.

## Key Types

- `PowerPoint.SlideCollection` — `presentation.slides`. Methods: `getItemAt(index)`, `getItemOrNullObject(id)`, `load("items/...")`.
- `PowerPoint.Slide` — single slide proxy. Properties: `id`, `layout`, `slideMaster`, `shapes`, `tags`, `notesPage`. Methods: `delete()`, `moveTo(index)`, `duplicate()`, `exportAsBase64()`.
- `PowerPoint.ShapeCollection` — `slide.shapes`. All shapes on a slide. See the `shapes` skill.
- `PowerPoint.Tags` — `slide.tags`. Key-value metadata on a slide. See the `tags` skill.

## Slide Identity

Each slide has a string `id` assigned by the runtime — it is stable across session and is the canonical way to reference a specific slide when using `getItemOrNullObject(id)`. The zero-based position in the collection is transient and changes when slides are reordered.

## Accessing Slides

### By Index (0-based)

`getItemAt(index)` is **0-based**. The first slide is at index `0`.

```javascript
await PowerPoint.run(async (context) => {
  // Get the first slide (index 0).
  const firstSlide = context.presentation.slides.getItemAt(0);
  firstSlide.load("id");
  await context.sync();

  console.log("First slide id:", firstSlide.id);
});
```

### By ID

Use `getItemOrNullObject(id)` when you have a slide ID from a prior sync. Check `isNullObject` before using the result.

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

## Iterate All Slides — Log ID and Shape Count

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  // Load shape counts for all slides in one batch.
  slides.items.forEach((slide) => slide.shapes.load("items/id"));
  await context.sync();

  slides.items.forEach((slide, index) => {
    console.log(`Slide ${index + 1}: id=${slide.id}, shapes=${slide.shapes.items.length}`);
  });
});
```

## Delete a Slide

`slide.delete()` removes the slide from the deck. Queued synchronously; call `context.sync()` to commit.

```javascript
await PowerPoint.run(async (context) => {
  // Delete the slide at index 2 (the third slide, 0-based).
  const slide = context.presentation.slides.getItemAt(2);
  slide.delete();
  await context.sync();
});
```

## Duplicate a Slide and Move the Copy to the End

`slide.duplicate()` returns a proxy for the new slide. `moveTo(index)` repositions it. After `context.sync()`, you can read the slide's `id` if needed.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  const slideCount = slides.items.length;

  // Duplicate the first slide.
  const original = slides.getItemAt(0);
  const copy = original.duplicate();

  // Move the copy to the last position (0-based, so count is correct after insert).
  copy.moveTo(slideCount);

  await context.sync();
  console.log("Slide duplicated and moved to end.");
});
```

## Move a Slide to a New Position

`moveTo(index)` places the slide at the given 0-based position. Other slides shift to accommodate.

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

## Export a Slide as Base64

`slide.exportAsBase64()` returns a `ClientResult<string>`. You must `await context.sync()` before reading `.value`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const result = slide.exportAsBase64();
  await context.sync();

  const base64 = result.value; // Complete .pptx of this one slide.
  console.log("Exported slide, base64 length:", base64.length);
});
```

## Adding New Slides (No slides.add())

There is **no `slides.add()` method** in the PowerPoint typed API. To add a new slide, use `presentation.insertSlidesFromBase64(base64Pptx, options?)` with a complete `.pptx` file as the source. This is the standard OOXML round-trip pattern. See the `ooxml` skill for full examples.

```javascript
// Pattern — new slides come from insertSlidesFromBase64, not slides.add().
await PowerPoint.run(async (context) => {
  // base64Pptx must be a full .pptx file encoded as base64.
  const base64Pptx = "..."; // Build or fetch this externally.

  context.presentation.insertSlidesFromBase64(base64Pptx, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });

  await context.sync();
});
```

## Per-Slide Layout and Master

`slide.layout` is the `SlideLayout` applied to this slide. `slide.slideMaster` is the `SlideMaster`. Both are proxy objects that need `load()` before reading their properties. See the `slide-layouts` skill.

## Common Mistakes

- **Assuming `slides.add()` exists** — it does not. New slides require `presentation.insertSlidesFromBase64(...)`. See the `ooxml` skill.
- **Treating `getItemAt` index as 1-based** — it is **0-based**. Slide 1 in the UI is `getItemAt(0)`.
- **Not loading the collection before reading `items.length`** — call `slides.load("items/id")` and sync before checking `slides.items.length`.
- **`moveTo` index ambiguity** — after calling `duplicate()`, the collection length increases before `moveTo` is evaluated at sync time. Use the pre-duplicate length as the target end index.
- **Calling `exportAsBase64()` and reading `.value` before sync** — `exportAsBase64()` returns a `ClientResult<string>`. The `.value` is only populated after `await context.sync()`.
- **Deleting a slide while iterating `slides.items`** — mutating the collection while iterating can produce unexpected results. Collect the slides to delete first, then call `delete()` in a separate pass.

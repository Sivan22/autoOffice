# Presentation — Top-Level Presentation Object

`context.presentation` is the root of the PowerPoint object model inside `PowerPoint.run`. It gives access to metadata, the slide collection, slide masters, and selection state. Most structural changes to the deck flow through this object.

## Key Types

- `PowerPoint.Presentation` — accessed via `context.presentation`. Properties: `title`, `slides`, `slideMasters`, `tags`.
- `PowerPoint.SlideCollection` — `presentation.slides`. Ordered collection of all slides. Use `getItemAt(index)` (0-based) or `getItemOrNullObject(id)`.
- `PowerPoint.SlideMasterCollection` — `presentation.slideMasters`. Collection of all slide masters in the deck.
- `PowerPoint.Tags` — `presentation.tags`. Key-value metadata attached to the presentation. See the `tags` skill.

## Presentation Properties

| Property | Type | Notes |
|---|---|---|
| `title` | `string` | The deck's internal title metadata, **not** the file name. Must be loaded before reading. |
| `slides` | `SlideCollection` | All slides, in order. |
| `slideMasters` | `SlideMasterCollection` | All slide masters. |
| `tags` | `Tags` | Presentation-level key-value metadata. |

## Presentation Methods

| Method | Description |
|---|---|
| `getSelectedSlides()` | Returns a `SlideScopedCollection` of currently selected slides. |
| `getSelectedShapes()` | Returns a `ShapeScopedCollection` of currently selected shapes. |
| `getSelectedTextRange()` | Returns the `TextRange` of the currently selected text cursor or selection. May throw if no text is selected. |
| `insertSlidesFromBase64(base64File, options?)` | Inserts slides from a base64-encoded `.pptx` file. Primary path for adding new slides with specific layouts, tables, charts, or other content not available via typed API. See the `ooxml` skill. |

## Load and Read Title and Slide Count

Properties are not populated until `load()` + `await context.sync()`. Load comma-separated property names in a single string.

```javascript
await PowerPoint.run(async (context) => {
  const presentation = context.presentation;
  const slides = presentation.slides;

  presentation.load("title");
  slides.load("items/id");
  await context.sync();

  console.log("Title:", presentation.title);
  console.log("Slide count:", slides.items.length);
});
```

## Access All Slides

Use the `slides` collection and load the sub-properties you need across all items in one sync.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  slides.items.forEach((slide, index) => {
    console.log(`Slide ${index + 1}: id=${slide.id}`);
  });
});
```

## Access All Slide Masters

```javascript
await PowerPoint.run(async (context) => {
  const masters = context.presentation.slideMasters;
  masters.load("items/id, items/name");
  await context.sync();

  masters.items.forEach((master) => {
    console.log(`Master: ${master.name} (id=${master.id})`);
  });
});
```

## Insert Slides from Base64 (OOXML Round-Trip)

When you need to add new slides — especially with specific layouts, tables, charts, or complex formatting — build a `.pptx` file, base64-encode it, and call `insertSlidesFromBase64`. The inserted slides are appended by default; use `options.targetSlideId` to control position.

```javascript
await PowerPoint.run(async (context) => {
  // base64Pptx is a base64-encoded complete .pptx file (not a URL, not raw XML).
  const base64Pptx = "..."; // Provided by caller or constructed via OOXML.

  context.presentation.insertSlidesFromBase64(base64Pptx, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });

  await context.sync();
});
```

See the `ooxml` skill for full patterns on constructing and round-tripping `.pptx` files.

## Read the Currently Selected Slides

```javascript
await PowerPoint.run(async (context) => {
  const selectedSlides = context.presentation.getSelectedSlides();
  selectedSlides.load("items/id");
  await context.sync();

  if (selectedSlides.items.length === 0) {
    console.log("No slides selected.");
  } else {
    selectedSlides.items.forEach((slide) => {
      console.log("Selected slide id:", slide.id);
    });
  }
});
```

## Limitations

- **No `presentation.save()`**: There is no API to programmatically save or export the presentation file from within `PowerPoint.run`. The user must save manually, or you can use `slide.exportAsBase64()` to export individual slides.
- **No typed table or chart creation**: Inserting tables, charts, SmartArt, or complex layouts requires the OOXML round-trip via `insertSlidesFromBase64`. See the `ooxml` skill.
- **No `slides.add()`**: There is no method to add a blank slide directly to the collection. All new slides come from `insertSlidesFromBase64`. See the `slides` skill.

## Common Mistakes

- **Assuming `presentation.save()` exists**: There is no save API in `PowerPoint.run`. Do not try to call it.
- **Treating `title` as the file name**: `presentation.title` is the internal metadata title (from File > Properties), not the `.pptx` filename. They may differ.
- **Reading `title` without `load`**: Like all proxy properties, `title` is `undefined` until you call `presentation.load("title")` + `await context.sync()`.
- **Passing a URL or XML fragment to `insertSlidesFromBase64`**: The argument must be a base64-encoded complete `.pptx` zip package. A URL or a raw XML string will fail. See the `ooxml` skill.
- **Assuming `getSelectedTextRange()` is safe to call unconditionally**: When no text is selected, this method may throw. Wrap in a try/catch or use `getSelectedShapes()` first. See the `selection` skill.

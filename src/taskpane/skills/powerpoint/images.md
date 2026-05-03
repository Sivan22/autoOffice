# Images — Working with Images in PowerPoint

## Typed-API Gap: No `addImage` in PowerPoint.run

`PowerPoint.ShapeCollection` does **not** expose `addImage(...)`. This is a definitive gap in the typed API — unlike Excel, which has `worksheet.shapes.addImage(base64)`, PowerPoint's `slide.shapes` collection has no equivalent method.

To insert a new image into a slide, you must use an OOXML round-trip: package a `.pptx` file that contains the image slide and call `presentation.insertSlidesFromBase64(base64, options)`. See the `ooxml` skill for details.

---

## Key Types

- `PowerPoint.Shape` — an image shape has `type === "Image"`. Geometry props (`top`, `left`, `width`, `height`) work the same as any shape.
- `PowerPoint.ShapeType` — the value for images is the string `"Image"`.
- `slide.exportAsBase64()` — exports the slide as a base64-encoded `.pptx` containing that one slide. Returns a `ClientResult<string>`.
- `presentation.slides.exportAsBase64Presentation(values)` — exports a subset of slides as a base64 `.pptx`.
- `presentation.insertSlidesFromBase64(base64, options?)` — the insertion entry point for OOXML round-trips.

---

## Listing All Image Shapes on a Slide

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type, items/left, items/top, items/width, items/height");
  await context.sync();

  const images = shapes.items.filter(s => s.type === "Image");
  if (images.length === 0) {
    console.log("No image shapes on this slide.");
    return;
  }

  for (const img of images) {
    console.log(
      `Image "${img.name}" — pos: (${img.left}pt, ${img.top}pt) size: ${img.width}pt × ${img.height}pt`
    );
  }
});
```

---

## Repositioning and Resizing an Existing Image Shape

Image shapes support the same geometry properties as any other shape.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type");
  await context.sync();

  const img = shapes.items.find(s => s.type === "Image" && s.name === "CompanyLogo");
  if (img) {
    const liveShape = slide.shapes.getItem(img.id);
    liveShape.left   = 600;  // points from left edge
    liveShape.top    = 20;   // points from top edge
    liveShape.width  = 120;  // points wide
    liveShape.height = 40;   // points tall
    await context.sync();
  }
});
```

---

## Deleting an Image Shape

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/type");
  await context.sync();

  // Delete all image-typed shapes on the active slide.
  const toDelete = shapes.items.filter(s => s.type === "Image");
  for (const img of toDelete) {
    slide.shapes.getItem(img.id).delete();
  }
  await context.sync();
});
```

---

## Inserting an Image via OOXML Round-Trip (Sketch)

Because `slide.shapes.addImage` does not exist, image insertion follows this pattern:

1. Obtain a base64-encoded `.pptx` file that contains the desired image on a slide (built server-side, from a template, or supplied by the user).
2. Call `presentation.insertSlidesFromBase64(base64pptx, { formatting: "KeepSourceFormatting" })` to merge that slide into the presentation.
3. Optionally move or resize the resulting shape using the geometry properties shown above.

```javascript
// Assumes `base64PptxWithImage` is a base64 string for a .pptx file
// containing a single slide with the image already placed on it.
await PowerPoint.run(async (context) => {
  context.presentation.insertSlidesFromBase64(base64PptxWithImage, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });
  await context.sync();
  console.log("Slide with image inserted.");
});
```

See the `ooxml` skill for the full round-trip pattern, including `exportAsBase64` for reading slides back out.

---

## Exporting a Slide That Contains Images

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const result = slide.exportAsBase64();
  await context.sync();

  console.log("Base64 length:", result.value.length);
  // result.value is a complete base64-encoded .pptx — can be re-imported
  // into another presentation via insertSlidesFromBase64.
});
```

---

## Common Mistakes

- **Calling `slide.shapes.addImage(...)`**: This method does not exist in `PowerPoint.run`. The typed API for PowerPoint shapes has no `addImage`. Use the OOXML round-trip via `insertSlidesFromBase64`.
- **Expecting `shape.image.getImageAsBase64()`**: `PowerPoint.Shape` has no `.image` proxy. To export a shape's rendered view, use `shape.getImageAsBase64(options?)` (PowerPointApi 1.10) — but this renders the shape as a PNG/JPEG, it does not give you the underlying image file.
- **Confusing PowerPoint with Excel**: Excel's `worksheet.shapes.addImage(base64)` has no equivalent in PowerPoint. The namespaces have different APIs.
- **Replacing an image in-place**: There is no API to swap an image's content without deleting the old shape and re-inserting via OOXML round-trip.
- **Loading `items/image`**: `ShapeLoadOptions` does not have an `image` sub-property. Load `items/type` to detect images, then work with geometry properties.

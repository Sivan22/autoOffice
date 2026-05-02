# Shapes — Adding, Inspecting, and Modifying PowerPoint Shapes

Shapes are the primary content container on a slide. Every text box, geometric shape, image, table, line, and chart is a `PowerPoint.Shape`. Use `slide.shapes` to add and iterate shapes.

## Key Types

- `PowerPoint.ShapeCollection` — `slide.shapes`. Add methods: `addGeometricShape(type, options?)`, `addLine(connectorType?, options?)`, `addTextBox(text, options?)`, `addGroup(values)`, `addTable(rowCount, columnCount, options?)`. **There is no `addImage`** — image insertion requires an OOXML round-trip (see `images` skill).
- `PowerPoint.Shape` — a single shape on a slide. Core properties: `id`, `name`, `type`, `top`, `left`, `width`, `height`, `rotation`, `fill`, `lineFormat`, `textFrame`, `tags`. Navigation: `getParentSlide()`, `getParentSlideOrNullObject()`.
- `PowerPoint.ShapeAddOptions` — `{ left?, top?, width?, height? }` — all values in points (1 pt = 1/72 inch).
- `PowerPoint.ShapeType` — enum identifying what a shape holds. String values: `"Unsupported"`, `"Image"`, `"GeometricShape"`, `"Group"`, `"Line"`, `"Table"`, `"Callout"`, `"Chart"`, `"ContentApp"`, `"Diagram"`, `"Freeform"`, `"Graphic"`, `"Ink"`, `"Media"`, `"Model3D"`, `"Ole"`, `"Placeholder"`, `"SmartArt"`, `"TextBox"`.
- `PowerPoint.ShapeFill` — `shape.fill`. Method: `setSolidColor(htmlColor)`. Property: `foregroundColor` (string), `transparency` (0-1).
- `PowerPoint.ShapeLineFormat` — `shape.lineFormat`. Properties: `color`, `weight`, `dashStyle`, `transparency`, `visible`.
- `PowerPoint.TextFrame` — `shape.textFrame` (throws if the shape has no text frame). Use `shape.getTextFrameOrNullObject()` (PowerPointApi 1.10) to get a null-safe handle.
- `Shape.setHyperlink(options?)` (PowerPointApi 1.8) — attaches a hyperlink to the entire shape. Full coverage of hyperlink targets, types, and reading patterns is in the `hyperlinks` skill.

---

## Adding a Geometric Shape

`shapes.addGeometricShape(type, options?)` returns the new `Shape`. The `type` argument is a `PowerPoint.GeometricShapeType` string such as `"Rectangle"`, `"Ellipse"`, `"Triangle"`, `"RightTriangle"`, `"Diamond"`, `"RoundRectangle"`, `"Star5"`, `"Heart"`, etc.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shape = slide.shapes.addGeometricShape("Rectangle", {
    left: 100,
    top: 80,
    width: 300,
    height: 150,
  });

  // Set a solid fill color.
  shape.fill.setSolidColor("#2196F3");

  // Give the shape a name so it can be found later.
  shape.name = "BlueBanner";

  await context.sync();
});
```
---

## Adding a Text Box

`shapes.addTextBox(text, options?)` creates a text box and sets its initial content. To update the text later, use `shape.textFrame.textRange.text`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const box = slide.shapes.addTextBox("Hello, PowerPoint!", {
    left: 50,
    top: 50,
    width: 400,
    height: 60,
  });

  // Style the text.
  box.textFrame.textRange.font.bold = true;
  box.textFrame.textRange.font.size = 24;
  box.textFrame.textRange.font.color = "#FFFFFF";

  // Style the box itself.
  box.fill.setSolidColor("#333333");

  await context.sync();
});
```

---
## Adding a Line

`shapes.addLine(connectorType?, options?)` — connector type is `"Straight"`, `"Elbow"`, or `"Curve"`. Options `left`/`top` set the start position; `width`/`height` set the end offset.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  slide.shapes.addLine("Straight", {
    left: 50,
    top: 300,
    width: 500,
    height: 0,
  });
  await context.sync();
});
```

---

## Iterating Shapes on a Slide

Always `load` the properties you need, then `await context.sync()` before reading them.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type, items/left, items/top, items/width, items/height");
  await context.sync();

  for (const shape of shapes.items) {
    console.log(`${shape.name} | type: ${shape.type} | pos: (${shape.left}, ${shape.top}) | size: ${shape.width}x${shape.height}`);
  }
});
```

---

## Deleting Shapes Matching a Criterion

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/type");
  await context.sync();

  // Delete every image-typed shape on the slide.
  const toDelete = shapes.items.filter(s => s.type === "Image");
  for (const shape of toDelete) {
    slide.shapes.getItem(shape.id).delete();
  }
  await context.sync();
});
```

---

## Accessing a Shape's Table

When `shape.type === "Table"`, call `shape.getTable()` to get the `Table` object.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/type");
  await context.sync();

  const tableShape = shapes.items.find(s => s.type === "Table");
  if (tableShape) {
    const table = tableShape.getTable();
    table.load("rowCount, columnCount");
    await context.sync();
    console.log(`Table: ${table.rowCount} rows x ${table.columnCount} cols`);
  }
});
```

---

## Finding a Shape by Name

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/name, items/id");
  await context.sync();

  const target = shapes.items.find(s => s.name === "BlueBanner");
  if (target) {
    const liveShape = slide.shapes.getItem(target.id);
    liveShape.fill.setSolidColor("#FF5722");
    await context.sync();
  }
});
```

---

## Common Mistakes

- **Calling `slide.shapes.addImage(...)`**: This method does not exist in PowerPoint.run. Image insertion requires an OOXML round-trip via `presentation.insertSlidesFromBase64`. See the `images` skill.
- **Confusing points with pixels**: All geometry values (`left`, `top`, `width`, `height`) are in points (72 pt = 1 inch). A typical 10-inch-wide slide is 720 pt. Do not pass pixel values.
- **Reading `shape.type` before sync**: `shape.type` is a proxy property. You must `load("items/type")` and `await context.sync()` before reading it.
- **Accessing `shape.textFrame` on a non-text shape**: `shape.textFrame` throws `InvalidArgument` on shapes that have no text frame (e.g. images, tables). Use `shape.getTextFrameOrNullObject()` (PowerPointApi 1.10) and check `isNullObject` before accessing.
- **Using `shape.getTable()` as a property**: The Table is accessed via `shape.getTable()` (a method call), not `shape.table`. Only call this when `shape.type === "Table"`.
- **Using `shape.parentSlide` as a property**: There is no `shape.parentSlide` property. Use `shape.getParentSlide()` or `shape.getParentSlideOrNullObject()`.
- **Resizing a group shape directly**: Setting `width`/`height` on a group cascades to all children proportionally. Verify the intended behavior before resizing a group.
- **Enum casing**: ShapeType string literals are title-case — `"GeometricShape"`, `"TextBox"`, `"Image"` — not `"geometricShape"` or `"TEXT_BOX"`.

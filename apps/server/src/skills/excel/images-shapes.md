# Images and Shapes — Inserting, Positioning, and Managing Shapes

## Key Types
- `Excel.ShapeCollection` — `worksheet.shapes`. Methods: `addImage(base64String)`, `addGeometricShape(geometricShapeType)`, `addLine(startLeft, startTop, endLeft, endTop, connectorType)`, `addTextBox(text)`, `getItem(name)`, `getItemAt(index)`.
- `Excel.Shape` — returned by all `shapes.add*` methods. Properties: `left`, `top`, `width`, `height` (all in points), `name`, `altTextTitle`, `altTextDescription`, `type`, `geometricShapeType`. Methods: `setZOrder(position)`, `delete()`. Child objects: `fill`, `textFrame`.
- `Excel.GeometricShapeType` — enum: `rectangle`, `oval`, `roundedRectangle`, `triangle`, `arrow`, `star5`, and many more.
- `Excel.ConnectorType` — enum for lines: `straight`, `elbow`, `curve`.
- `Excel.ShapeZOrder` — enum: `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`.
- `Excel.ShapeFill` — `shape.fill`. Method: `setSolidColor(color)`.
- `Excel.TextFrame` — `shape.textFrame`. Property: `textRange.text` for reading/setting the text of a text box or shape.

---

## Inserting an Image

`worksheet.shapes.addImage(base64String)` — inserts a PNG or JPG image from a raw base64 string. The string must NOT include the `data:image/png;base64,` data-URL prefix — pass only the raw base64 content.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // base64Str is a raw base64-encoded PNG or JPG — no data-URL prefix.
  const shape = sheet.shapes.addImage(base64Str);

  shape.left   = 50;   // points from the left edge of the worksheet
  shape.top    = 50;   // points from the top edge of the worksheet
  shape.width  = 200;
  shape.height = 100;

  await context.sync();
});
```

---

## Inserting a Geometric Shape

`worksheet.shapes.addGeometricShape(geometricShapeType)` — inserts a preset shape like a rectangle, oval, or arrow.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const shape = sheet.shapes.addGeometricShape(Excel.GeometricShapeType.rectangle);

  shape.left   = 100;
  shape.top    = 80;
  shape.width  = 150;
  shape.height = 60;

  await context.sync();
});
```

Common `GeometricShapeType` values: `rectangle`, `oval`, `roundedRectangle`, `triangle`, `arrow`, `star5`.

---

## Inserting a Line

`worksheet.shapes.addLine(startLeft, startTop, endLeft, endTop, connectorType)` — all coordinates are in points.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Draw a straight horizontal line.
  const line = sheet.shapes.addLine(
    50,   // startLeft
    100,  // startTop
    300,  // endLeft
    100,  // endTop
    Excel.ConnectorType.straight
  );

  await context.sync();
});
```

`ConnectorType` values: `straight`, `elbow`, `curve`.

---

## Inserting a Text Box

`worksheet.shapes.addTextBox(text)` — creates a floating text box with the given initial text.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const shape = sheet.shapes.addTextBox("Hello, World!");

  shape.left   = 20;
  shape.top    = 20;
  shape.width  = 120;
  shape.height = 40;

  await context.sync();
});
```

---

## Moving and Resizing

Assign new values to `left`, `top`, `width`, and `height`. All values are in points.

```javascript
shape.left   = 200;
shape.top    = 150;
shape.width  = 300;
shape.height = 120;
```

---

## Z-Order

```javascript
shape.setZOrder(Excel.ShapeZOrder.bringToFront);
shape.setZOrder(Excel.ShapeZOrder.sendToBack);
shape.setZOrder(Excel.ShapeZOrder.bringForward);
shape.setZOrder(Excel.ShapeZOrder.sendBackward);
```

---

## Reading Shape Properties

Load the properties you need before calling `sync()`.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const shape = sheet.shapes.getItem("MyShape");

  shape.load("name, type, left, top, width, height, geometricShapeType");
  await context.sync();

  console.log("Name:", shape.name);
  console.log("Type:", shape.type);
  console.log("Position:", shape.left, shape.top);
  console.log("Size:", shape.width, "x", shape.height);
});
```

---

## Deleting a Shape

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const shape = sheet.shapes.getItem("MyShape");

  shape.delete();

  await context.sync();
});
```

---

## Example 1 — Insert a Base64 PNG at (50, 50), Sized 200×100 with Alt Text

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // base64Str must be a raw base64 string — do NOT include "data:image/png;base64,"
  const shape = sheet.shapes.addImage(base64Str);

  shape.left             = 50;
  shape.top              = 50;
  shape.width            = 200;
  shape.height           = 100;
  shape.altTextTitle       = "Company Logo";
  shape.altTextDescription = "The company logo in PNG format.";
  shape.name             = "CompanyLogo";

  await context.sync();
});
```

---

## Example 2 — Insert a Rectangle, Set Fill Color, and Bring to Front

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  const shape = sheet.shapes.addGeometricShape(Excel.GeometricShapeType.rectangle);

  shape.left   = 100;
  shape.top    = 80;
  shape.width  = 160;
  shape.height = 60;
  shape.name   = "BlueBanner";

  // Set a solid fill color.
  shape.fill.setSolidColor("#0078D4");

  // Bring to front so it renders above other shapes.
  shape.setZOrder(Excel.ShapeZOrder.bringToFront);

  await context.sync();
});
```

---

## Common Mistakes

- **Base64 string must not include the data-URL prefix**: `addImage` expects the raw base64 content only. If you pass `"data:image/png;base64,iVBOR..."`, the image will fail to load. Strip the prefix first: `base64Str = dataUrl.split(",")[1]`.
- **Coordinates are in points, not pixels**: All `left`, `top`, `width`, and `height` values are measured in typographic points (1 inch = 72 points). One default Excel column is approximately 48 points wide. Passing pixel values without converting will misplace or mis-size the shape.
- **Reading properties requires `load()` and `sync()`**: Shape properties like `left`, `top`, `name`, and `type` are proxy values. Access them after `shape.load("left, top, ...")` and `await context.sync()`, not immediately after `addGeometricShape`.
- **`getItem(name)` uses the shape name, not a numeric index**: Use `sheet.shapes.getItemAt(0)` for index-based access. Shape names are set via `shape.name` and default to generic names like `"Picture 1"` or `"Rectangle 2"`.

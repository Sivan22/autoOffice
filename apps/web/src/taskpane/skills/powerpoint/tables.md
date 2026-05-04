# Tables — Creating and Working with PowerPoint Tables

PowerPoint tables are supported by a fully typed API (PowerPointApi 1.8+). Use `slide.shapes.addTable(rowCount, columnCount, options?)` to create a table. Navigate to individual cells via `table.getCellOrNullObject(rowIndex, columnIndex)`.

## Key Types

- `PowerPoint.Table` — obtained via `shape.getTable()` on a shape whose `type === "Table"`. Properties: `rowCount`, `columnCount`, `rows` (`TableRowCollection`), `columns` (`TableColumnCollection`), `styleSettings` (`TableStyleSettings`), `values` (`string[][]` read-only). Methods: `getCellOrNullObject(rowIndex, columnIndex)`, `mergeCells(...)`, `clear()`, `getShape()`.
- `PowerPoint.TableCell` — `table.getCellOrNullObject(row, col)`. Properties: `text` (string, direct read/write), `font` (`ShapeFont`), `fill` (`ShapeFill`), `borders` (`Borders`), `horizontalAlignment`, `verticalAlignment`, `indentLevel`, `textRuns`. Methods: `resize(rowCount, colCount)`, `split(rowCount, colCount)`.
- `PowerPoint.TableStyleSettings` — `table.styleSettings`. Properties: `style` (writable `PowerPoint.TableStyle` string), `isFirstRowHighlighted`, `isLastRowHighlighted`, `isFirstColumnHighlighted`, `isLastColumnHighlighted`, `areRowsBanded`, `areColumnsBanded`.
- `PowerPoint.TableAddOptions` — `{ left?, top?, width?, height?, style?, rows?, columns?, specificCellProperties?, mergedAreas? }`. Set `style` at creation time (PowerPointApi 1.9).
- `PowerPoint.ShapeFill` — `cell.fill`. Method: `setSolidColor(htmlColor)`.
- `PowerPoint.ShapeFont` — `cell.font`. Properties: `bold`, `italic`, `color`, `size`, `name`, `underline`.

---

## Creating a Table

`slide.shapes.addTable(rowCount, columnCount, options?)` returns a `Shape`. Call `shape.getTable()` to get the `Table` object.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);

  // Add a 3-row x 3-column table.
  const tableShape = slide.shapes.addTable(3, 3, {
    left: 100,
    top: 150,
    width: 500,
    height: 200,
  });

  const table = tableShape.getTable();

  // Write header row (row 0).
  const headers = ["Product", "Units", "Revenue"];
  for (let col = 0; col < headers.length; col++) {
    const cell = table.getCellOrNullObject(0, col);
    cell.text = headers[col];
    cell.font.bold = true;
    cell.fill.setSolidColor("#2196F3");
    cell.font.color = "#FFFFFF";
  }

  // Write data rows.
  const rows = [
    ["Alpha", "120", "$24,000"],
    ["Beta",  "85",  "$17,000"],
  ];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      table.getCellOrNullObject(r + 1, c).text = rows[r][c];
    }
  }

  await context.sync();
});
```

---

## Setting a Table Style

Apply a built-in style at creation via `options.style`, or update it after creation via `table.styleSettings.style`.

Common style names: `"LightStyle1"`, `"LightStyle1Accent1"`, `"MediumStyle1"`, `"MediumStyle1Accent1"`, `"MediumStyle2"`, `"DarkStyle1"`, `"DarkStyle1Accent1"`, `"NoStyleTableGrid"`, `"ThemedStyle1Accent1"`.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);

  // Create with style.
  const tableShape = slide.shapes.addTable(4, 3, {
    left: 80,
    top: 120,
    width: 560,
    height: 220,
    style: "MediumStyle1Accent1",
  });

  const table = tableShape.getTable();
  table.styleSettings.isFirstRowHighlighted = true;
  table.styleSettings.areRowsBanded = true;

  await context.sync();
});
```

---

## Reading All Cell Values at Once

`table.values` is a read-only `string[][]` containing all cell text. Load it, sync, then read.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/type");
  await context.sync();

  const tableShape = shapes.items.find(s => s.type === "Table");
  if (!tableShape) return;

  const table = tableShape.getTable();
  table.load("values, rowCount, columnCount");
  await context.sync();

  console.log(`Table ${table.rowCount}x${table.columnCount}`);
  for (let r = 0; r < table.values.length; r++) {
    console.log(`Row ${r}:`, table.values[r].join(" | "));
  }
});
```

---

## Styling Individual Cells in an Existing Table

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/type");
  await context.sync();

  const tableShape = shapes.items.find(s => s.type === "Table");
  if (!tableShape) return;

  const table = tableShape.getTable();
  table.load("rowCount, columnCount");
  await context.sync();

  // Make the entire first column italic.
  for (let row = 0; row < table.rowCount; row++) {
    const cell = table.getCellOrNullObject(row, 0);
    // getCellOrNullObject returns a null object for non-top-left merged cells.
    // For unmerged tables, this is always a real cell.
    cell.font.italic = true;
  }
  await context.sync();
});
```

---

## Common Mistakes

- **`shape.table` as a property**: There is no `shape.table` property. Access the table via `shape.getTable()` (a method). Only valid when `shape.type === "Table"`.
- **`table.getCell(r, c)` — method does not exist**: Only `table.getCellOrNullObject(rowIndex, columnIndex)` exists. A null object (`.isNullObject === true`) is returned for non-top-left positions of merged areas.
- **Setting cell text via `cell.textFrame.textRange`**: `TableCell` has no `textFrame`. Set and read text directly via `cell.text` — it is a plain writable string property.
- **`table.style` as a direct property**: The style is on `table.styleSettings.style`, not `table.style`. You can also set the style at creation time via `TableAddOptions.style`.
- **Writing values like Excel (`table.values = [[...]]`)**: `table.values` is read-only. Set each cell individually via `table.getCellOrNullObject(r, c).text = "..."`.
- **Forgetting `addTable` returns a Shape, not a Table**: The return value of `slide.shapes.addTable(...)` is a `PowerPoint.Shape`. Call `.getTable()` on it to reach the `PowerPoint.Table` object.
- **`table.rows.items` before loading**: `table.rows.load("items/...")` and sync are required before accessing `items`.

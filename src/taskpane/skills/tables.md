# Tables — Creation, Rows, Columns, Cells

## Key Types
- `Word.Table` — rows, columns, values, style, getCell(), addRows(), addColumns(), getBorder()
- `Word.TableRow` — cells, font, horizontalAlignment, shadingColor
- `Word.TableCell` — body, value, columnWidth, shadingColor
- `Word.TableBorder` — type, color, width

## Create a Table

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  // Insert a 3x3 table with values
  const values = [
    ["Name", "Age", "City"],
    ["Alice", "30", "NYC"],
    ["Bob", "25", "LA"]
  ];
  
  const table = body.insertTable(values.length, values[0].length, Word.InsertLocation.end, values);
  
  // Style the header row
  table.getRow(0).font.bold = true;
  table.getRow(0).shadingColor = "#D9E2F3";
  
  await context.sync();
});
```

## Read Table Data

```javascript
await Word.run(async (context) => {
  const tables = context.document.body.tables;
  tables.load("items");
  await context.sync();
  
  const table = tables.items[0];
  table.load("rowCount,columnCount,values");
  await context.sync();
  
  console.log("Rows:", table.rowCount);
  console.log("Values:", table.values); // 2D array
});
```

## Modify Cells

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  
  // Get a specific cell (0-indexed)
  const cell = table.getCell(1, 2); // row 1, col 2
  cell.body.clear();
  cell.body.insertText("New Value", Word.InsertLocation.start);
  cell.shadingColor = "#FFFF00";
  
  await context.sync();
});
```

## Add Rows and Columns

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  
  // Add a row at the end
  table.addRows(Word.InsertLocation.end, 1, [["New", "Row", "Data"]]);
  
  // Add a column at the end
  table.addColumns(Word.InsertLocation.end, 1, ["Header", "Val1", "Val2"]);
  
  await context.sync();
});
```

## Delete a Table

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  table.delete();
  await context.sync();
});
```

## Delete a Row or Column

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  table.load("rowCount");
  await context.sync();

  // Delete the last row
  table.getRow(table.rowCount - 1).delete();

  // Delete column 0 on the first row's cell
  table.getCell(0, 0).deleteColumn();

  await context.sync();
});
```

## Merge Cells

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();

  // mergeCells(topRow, firstCell, bottomRow, lastCell) — 0-indexed
  table.mergeCells(0, 0, 0, 2); // merge first 3 cells of row 0 into one
  await context.sync();
});
```

## Cell Padding

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  const cell = table.getCell(0, 0);

  // Padding in points; cellPaddingLocation: top | bottom | left | right
  cell.setCellPadding(Word.CellPaddingLocation.top,    4);
  cell.setCellPadding(Word.CellPaddingLocation.bottom, 4);
  cell.setCellPadding(Word.CellPaddingLocation.left,   8);
  cell.setCellPadding(Word.CellPaddingLocation.right,  8);
  await context.sync();
});
```

```javascript
// Read cell padding
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  const cell = table.getCell(0, 0);

  const top = cell.getCellPadding(Word.CellPaddingLocation.top);
  top.load();
  await context.sync();

  console.log("Top padding:", top.value);
});
```

## Auto-fit and Distribute Columns

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();

  table.autoFitWindow();     // fit table to page width
  // or
  table.distributeColumns(); // make all columns equal width
  await context.sync();
});
```

## Table Style Flags (Banded Rows, First/Last Column, Total Row)

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();

  table.styleBandedRows    = true;   // alternate row shading
  table.styleBandedColumns = false;
  table.styleFirstColumn   = true;   // bold first column
  table.styleLastColumn    = false;
  table.styleTotalRow      = true;   // highlight last row as totals row
  table.styleHeaderRow     = true;   // highlight first row as header
  await context.sync();
});
```

## Apply a Table Style

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  // Use a built-in Word table style name (locale-dependent string)
  table.style = "Table Grid";
  // or a built-in enum value:
  table.styleBuiltIn = Word.BuiltInStyleName.tableGrid;
  await context.sync();
});
```

## Set Table Borders

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();

  // borderLocation: top | bottom | left | right | insideHorizontal | insideVertical | all
  const border = table.getBorder(Word.BorderLocation.all);
  border.type  = Word.BorderType.single;
  border.color = "#000000";
  border.width = 1.5; // points

  await context.sync();
});
```

## Remove Table Borders

```javascript
await Word.run(async (context) => {
  const table = context.document.body.tables.getFirst();
  const border = table.getBorder(Word.BorderLocation.all);
  border.type = Word.BorderType.none;
  await context.sync();
});
```

## Common Pitfalls

- `insertTable` values is a 2D string array — all values must be strings
- Cell indices are 0-based
- `table.values` returns all data as a 2D string array (read-only snapshot)
- Always `load("values")` before reading table data
- `table.style` is locale-dependent (e.g. `"Tableau grille"` in French) — prefer `styleBuiltIn` when possible
- `getBorder` returns a `Word.TableBorder` proxy; set its properties then call `context.sync()`
- `mergeCells` indices are inclusive and 0-based: `(topRow, firstCol, bottomRow, lastCol)`
- `getCellPadding` returns a proxy — load its `value` property before reading
- `autoFitWindow()` and `distributeColumns()` are fire-and-forget; they take effect on `context.sync()`

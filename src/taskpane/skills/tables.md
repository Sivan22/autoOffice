# Tables — Creation, Rows, Columns, Cells

## Key Types
- `Word.Table` — rows, columns, values, getCell(), addRows(), addColumns()
- `Word.TableRow` — cells, font, horizontalAlignment
- `Word.TableCell` — body, value, columnWidth, shadingColor

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

## Common Pitfalls

- `insertTable` values is a 2D string array — all values must be strings
- Cell indices are 0-based
- `table.values` returns all data as a 2D string array (read-only snapshot)
- Always `load("values")` before reading table data

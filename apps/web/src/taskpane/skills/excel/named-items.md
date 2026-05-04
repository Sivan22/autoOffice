# Named Items — Named Ranges, Formulas, and Constants

## Key Types
- `Excel.NamedItemCollection` — `context.workbook.names` (workbook scope) or `worksheet.names` (worksheet scope). Method `add(name, reference)` returns a `NamedItem`.
- `Excel.NamedItem` — properties: `name`, `formula`, `value`, `type`, `visible`, `scope`. Method: `delete()`.
- `Excel.NamedItemType` — enum: `string`, `integer`, `double`, `boolean`, `range`, `error`, `array`.
- `Excel.NamedItemScope` — enum: `worksheet`, `workbook`.

---

## Workbook Scope vs Worksheet Scope

Named items can live at two levels:

| Scope | Collection | Accessible from |
|---|---|---|
| Workbook | `context.workbook.names` | All sheets in the workbook |
| Worksheet | `worksheet.names` | That worksheet only |

When both scopes define the same name, the worksheet-scope name takes precedence **on that sheet**; the workbook-scope name remains active on all other sheets.

---

## Add a Named Range

Two overloads of `names.add(name, reference)`:

- **String formula** — pass the formula as an A1-notation string (must start with `=`):
  ```javascript
  context.workbook.names.add("TaxRate", "=Sheet1!$B$1");
  ```
- **Range object** — pass a `Range` directly (no `=` prefix needed):
  ```javascript
  const range = sheet.getRange("B1");
  context.workbook.names.add("TaxRate", range);
  ```

Both create a workbook-scope name. Use `worksheet.names.add(...)` for worksheet scope.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write the value the name will point to.
  sheet.getRange("B1").values = [[0.08]]; // 8% tax rate

  // Named range via Range object (workbook scope).
  const taxCell = sheet.getRange("B1");
  context.workbook.names.add("TaxRate", taxCell);

  await context.sync();
});
```

---

## Add a Named Formula (Constant)

A named item whose formula is a literal expression rather than a cell reference behaves like a named constant.

```javascript
await Excel.run(async (context) => {
  // Named constant — not tied to any cell.
  context.workbook.names.add("Discount", "=0.1");

  await context.sync();
});
```

After this, `=Discount` in any formula evaluates to `0.1`.

---

## Add a Worksheet-Scope Name

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getItem("Sales");

  // This name is only visible within the "Sales" sheet.
  sheet.names.add("LocalRate", "=Sales!$C$2");

  await context.sync();
});
```

---

## Reading a Named Item

Load `formula`, `value`, `type`, and `visible` before calling `context.sync()`.

```javascript
await Excel.run(async (context) => {
  const namedItem = context.workbook.names.getItem("TaxRate");
  namedItem.load("name, formula, value, type, visible");
  await context.sync();

  console.log("Name:    ", namedItem.name);
  console.log("Formula: ", namedItem.formula);  // e.g. "=Sheet1!$B$1"
  console.log("Value:   ", namedItem.value);    // the resolved value, e.g. 0.08
  console.log("Type:    ", namedItem.type);     // Excel.NamedItemType member
  console.log("Visible: ", namedItem.visible);  // false = hidden from the Name Box UI
});
```

---

## Iterate All Workbook Names

Use `load("items/name, items/formula")` on the collection, then iterate `names.items`.

```javascript
await Excel.run(async (context) => {
  const names = context.workbook.names;
  names.load("items/name, items/formula");
  await context.sync();

  for (const item of names.items) {
    console.log(`${item.name}  →  ${item.formula}`);
  }
});
```

---

## Delete a Named Item

```javascript
await Excel.run(async (context) => {
  const namedItem = context.workbook.names.getItem("TaxRate");
  namedItem.delete();
  await context.sync();
});
```

---

## Example 1 — Define a Workbook-Scope `TaxRate` Named Range, Then Use It in a Formula

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Seed data: price in A2, quantity in B2.
  sheet.getRange("A1:C1").values = [["Price", "Qty", "Total incl. Tax"]];
  sheet.getRange("A2:B2").values = [[50, 3]];

  // Store the tax rate in B4 and create a workbook-scope named range.
  sheet.getRange("B4").values    = [[0.08]];
  sheet.getRange("A4").values    = [["Tax Rate"]];
  const taxCell = sheet.getRange("B4");
  context.workbook.names.add("TaxRate", taxCell);

  // Use the named range in a formula: price × qty × (1 + TaxRate).
  sheet.getRange("C2").formulas = [["=A2*B2*(1+TaxRate)"]];

  sheet.getUsedRange(true).format.autofitColumns();

  await context.sync();
});
```

---

## Example 2 — List All Workbook Names with Their Formulas

```javascript
await Excel.run(async (context) => {
  const names = context.workbook.names;
  names.load("items/name, items/formula, items/type, items/visible");
  await context.sync();

  console.log(`Total named items: ${names.items.length}`);
  for (const item of names.items) {
    const visibility = item.visible ? "visible" : "hidden";
    console.log(`[${item.type}] ${item.name} = ${item.formula}  (${visibility})`);
  }
});
```

---

## Common Mistakes

- **Name collisions across scopes**: If `Sheet1` has a worksheet-scope name `Rate` and the workbook also has a workbook-scope `Rate`, formulas on `Sheet1` always resolve to the worksheet-scope version. The workbook-scope name still works on every other sheet. Plan your naming scheme to avoid confusion.
- **Absolute vs relative references in the formula string**: `"=Sheet1!$B$1"` creates a fixed named range that always points to B1. `"=Sheet1!B1"` is relative to the cell the name is evaluated from and may produce unexpected results. Prefer absolute (`$`) references for named ranges.
- **Reserved names**: Excel reserves certain names internally. You cannot create user names with these values: `Print_Area`, `Print_Titles`, `Auto_Open`, `Auto_Close`, `Consolidate_Area`, `Sheet_Title`, `Criteria`, `Extract`, `Database`. Attempting to add them via the API throws `InvalidArgument`.
- **`getItem` throws when the name does not exist**: Unlike some collections, there is no `getItemOrNullObject` guard by default — catch errors or check `names.items` first if the name's existence is uncertain.
- **`formula` string must start with `=`**: When passing a string reference (not a Range object) to `names.add`, the formula must begin with `=`. Omitting it silently stores a text value rather than a reference.
- **Worksheet-scope `getItem` only finds that sheet's names**: `worksheet.names.getItem("TaxRate")` only finds a name defined at worksheet scope for that sheet. To find a workbook-scope name, always use `context.workbook.names.getItem(...)`.

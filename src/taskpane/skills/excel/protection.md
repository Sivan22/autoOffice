# Protection — Workbook and Worksheet Protection

## Key Types
- `Excel.WorkbookProtection` — `context.workbook.protection`. Methods: `protect(options?, password?)`, `unprotect(password?)`. Property: `protected` (boolean, must be loaded).
- `WorkbookProtectionOptions` — plain object passed to `workbook.protection.protect()`. Fields: `allowEditRanges?` (array of range addresses), `protectStructure?` (boolean — prevent adding/deleting/renaming sheets), `protectWindows?` (boolean — prevent resizing the workbook window).
- `Excel.WorksheetProtection` — `worksheet.protection`. Methods: `protect(options?, password?)`, `unprotect(password?)`. Properties: `protected` (boolean), `options` (WorksheetProtectionOptions snapshot, must be loaded).
- `WorksheetProtectionOptions` — plain object controlling what users can do on a protected sheet. All booleans default to `false` (blocked) unless explicitly set to `true`:
  - `allowAutoFilter`, `allowSort` — filter and sort controls
  - `allowDeleteColumns`, `allowDeleteRows`, `allowInsertColumns`, `allowInsertRows` — structural edits
  - `allowFormatCells`, `allowFormatColumns`, `allowFormatRows` — formatting changes
  - `allowEditObjects`, `allowEditScenarios`, `allowPivotTables`, `allowInsertHyperlinks`
  - `selectionMode` — `Excel.ProtectionSelectionMode`: `normal` (any cell), `unlocked` (only unlocked cells), `none` (no selection)
- `Excel.RangeFormat.protection` — sub-object on `range.format` with two booleans: `locked` (default `true`) and `formulaHidden` (default `false`). Set `locked = false` BEFORE calling `worksheet.protection.protect()` to make cells editable on a protected sheet.

---

## Reading Protection State

Load `protected` (and optionally `options`) before reading.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  sheet.protection.load("protected, options");
  await context.sync();

  console.log("Sheet protected:", sheet.protection.protected);
  if (sheet.protection.protected) {
    console.log("Allow sort:", sheet.protection.options.allowSort);
    console.log("Allow auto-filter:", sheet.protection.options.allowAutoFilter);
  }
});
```

---

## Protecting the Workbook

`context.workbook.protection.protect(options?, password?)` — locks workbook structure or windows. Omit the password argument entirely to protect without one.

```javascript
await Excel.run(async (context) => {
  // Prevent users from adding, deleting, or renaming worksheets.
  context.workbook.protection.protect({ protectStructure: true });
  await context.sync();
});
```

Check state:

```javascript
await Excel.run(async (context) => {
  context.workbook.protection.load("protected");
  await context.sync();
  console.log("Workbook protected:", context.workbook.protection.protected);
});
```

Unprotect:

```javascript
await Excel.run(async (context) => {
  context.workbook.protection.unprotect();  // pass password string if one was set
  await context.sync();
});
```

---

## Protecting a Worksheet

`worksheet.protection.protect(options?, password?)` — locks the sheet per the given options. All operations not explicitly allowed will be blocked.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  sheet.protection.protect({
    allowAutoFilter: true,
    allowSort: true,
    // All other operations are blocked by default.
  });

  await context.sync();
});
```

Unprotect:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  sheet.protection.unprotect();  // pass password string if one was set
  await context.sync();
});
```

---

## Unlocking Specific Cells

By default every cell is locked (`range.format.protection.locked = true`). On a protected sheet, locked cells cannot be edited. To allow editing only in certain cells, unlock those cells BEFORE calling `protect()`.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Unlock the input range first.
  const inputRange = sheet.getRange("B2:B10");
  inputRange.format.protection.locked = false;

  // Now protect the sheet.  Cells outside B2:B10 remain locked.
  sheet.protection.protect({
    // No options needed unless you want to allow additional operations.
  });

  await context.sync();
});
```

---

## Example 1 — Protect a Sheet, Allow Sort and AutoFilter Only

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Do not set a password — pass no second argument.
  sheet.protection.protect({
    allowSort: true,
    allowAutoFilter: true,
  });

  await context.sync();
  console.log("Sheet is now protected. Only sort and auto-filter are permitted.");
});
```

---

## Example 2 — Unlock B2:B10, Then Protect so Only That Range Is Editable

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Step 1: unlock the data-entry range.
  const entryRange = sheet.getRange("B2:B10");
  entryRange.format.protection.locked = false;

  // Step 2: restrict selection to unlocked cells only, then protect.
  sheet.protection.protect({
    selectionMode: Excel.ProtectionSelectionMode.unlocked,
  });

  await context.sync();
  console.log("Only B2:B10 is editable. All other cells are locked.");
});
```

---

## Common Mistakes

- **Passwords are weak obfuscation, not encryption**: Excel sheet/workbook passwords are trivially bypassed with third-party tools. Do not rely on them to secure sensitive data — they only prevent accidental edits.
- **All operations are blocked by default**: If you call `protect({})` or `protect()` without any options, every operation (formatting, sorting, filtering, inserting rows, etc.) is blocked. You must explicitly set each `allow*` boolean to `true` to permit it.
- **Unlock cells BEFORE calling `protect()`**: Setting `range.format.protection.locked = false` has no effect after `protect()` is already active. Always unlock cells first, then protect the sheet.
- **`protect()` throws if the sheet is already protected**: Check `sheet.protection.protected` first, or call `unprotect()` before re-protecting with new options.
- **Some options are version-dependent**: `allowEditObjects` and a few others may not be available in older Excel API sets or on Excel on the web. Test in the target environment before relying on them.

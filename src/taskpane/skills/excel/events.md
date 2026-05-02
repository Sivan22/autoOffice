# Events — Worksheet and Workbook Event Handlers

## Key Types
- `Excel.EventHandlerResult` — returned by every `eventSource.add(handler)` call. Method: `remove()` — call to deregister the handler. Always `await context.sync()` after `remove()`.
- `Excel.DataChangeType` — enum describing why `onChanged` fired: `unknown`, `rangeEdited`, `rowInserted`, `rowDeleted`, `columnInserted`, `columnDeleted`, `cellInserted`, `cellDeleted`.
- `Excel.EventSource` — enum on `onChanged` event: `local` (user typed), `remote` (another user or add-in changed the value).

### Worksheet-level events (on `worksheet`)
| Event | Fires when | Key event properties |
|---|---|---|
| `onChanged` | A cell value changes | `address`, `changeType`, `source`, `worksheetId` |
| `onSelectionChanged` | The selection moves | `address`, `worksheetId` |
| `onActivated` | Sheet becomes active | `worksheetId` |
| `onDeactivated` | Sheet loses focus | `worksheetId` |
| `onCalculated` | Sheet finishes a recalculation | `worksheetId` |
| `onRowSorted` | Rows are sorted | `address`, `worksheetId` |
| `onColumnSorted` | Columns are sorted | `address`, `worksheetId` |
| `onFormatChanged` | Cell formatting changes | `address`, `worksheetId` |

### Workbook-level events (on collections)
| Event | Source |
|---|---|
| `context.workbook.worksheets.onAdded` | A new sheet is inserted |
| `context.workbook.worksheets.onDeleted` | A sheet is deleted |
| `context.workbook.worksheets.onActivated` | Any sheet is activated |
| `context.workbook.worksheets.onCalculated` | Any sheet recalculates |
| `context.workbook.tables.onChanged` | Any table value changes |

---

## Handler Shape

Each handler is an `async` function that receives the event object. Because the parent `Excel.run` has already returned by the time the event fires, the handler must open its own `Excel.run` to use the context.

```javascript
const handler = async (event) => {
  // event is available directly — no Excel.run needed to read its properties.
  console.log("Changed address:", event.address);
  console.log("Change type:", event.changeType);
  console.log("Source:", event.source);

  // Use a new Excel.run only if you need to read/write the workbook.
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const range = sheet.getRange(event.address);
    range.load("values");
    await context.sync();
    console.log("New value:", range.values[0][0]);
  });
};
```

Registering the handler:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // add() returns an EventHandlerResult used for later removal.
  const eventResult = sheet.onChanged.add(handler);

  await context.sync();
  console.log("onChanged handler registered.");
});
```

---

## Removing a Handler

Keep a reference to the `EventHandlerResult` returned by `add()`. Call `remove()` and sync when done.

```javascript
// eventResult was saved from the registration step.
await Excel.run(async (context) => {
  eventResult.remove();
  await context.sync();
  console.log("Handler removed.");
});
```

---

## Workbook-Level onChanged on Tables

```javascript
await Excel.run(async (context) => {
  const eventResult = context.workbook.tables.onChanged.add(async (event) => {
    console.log("Table changed:", event.tableId);
    console.log("Address:", event.address);
    console.log("Change type:", event.changeType);
  });

  await context.sync();
});
```

---

## Example 1 — Log Every Cell Change on the Active Sheet

```javascript
let changeHandlerResult;

async function registerChangeLogger() {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();

    const handler = async (event) => {
      console.log(`Cell changed: ${event.address}`);
      console.log(`Change type: ${event.changeType}`);
      console.log(`Source: ${event.source}`);
    };

    changeHandlerResult = sheet.onChanged.add(handler);
    await context.sync();
    console.log("Change logger registered.");
  });
}

registerChangeLogger();
```

---

## Example 2 — Register and Later Remove a Handler

```javascript
let selectionHandlerResult;

// Register.
async function registerSelectionHandler() {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();

    const handler = async (event) => {
      console.log("Selection moved to:", event.address);
    };

    selectionHandlerResult = sheet.onSelectionChanged.add(handler);
    await context.sync();
    console.log("Selection handler registered.");
  });
}

// Remove later (e.g. on add-in teardown).
async function removeSelectionHandler() {
  if (selectionHandlerResult) {
    await Excel.run(async (context) => {
      selectionHandlerResult.remove();
      await context.sync();
      console.log("Selection handler removed.");
    });
    selectionHandlerResult = undefined;
  }
}

await registerSelectionHandler();
// ... user interactions ...
await removeSelectionHandler();
```

---

## Common Mistakes

- **Handler body must use its own `Excel.run`**: When the event fires, the original `Excel.run` has already completed. The handler receives only the event object — there is no `context`. Wrap any workbook read/write inside a new `Excel.run` inside the handler.
- **Not removing handlers on teardown**: Every call to `add(handler)` registers a new listener. If your add-in initializes multiple times without removing old handlers, duplicate callbacks accumulate and fire for every event. Always call `eventResult.remove()` on teardown.
- **Handlers fire after the change, not before**: You cannot intercept or cancel a change from `onChanged`. The event is a notification, not a pre-change hook. Use data validation (`worksheet.dataValidations`) to restrict what users can enter.
- **`onChanged` does not fire for formula recalculation**: If a formula's upstream input changes and the formula re-evaluates, `onChanged` does not fire for the formula cell. Use `onCalculated` to detect recalculation results.
- **`eventResult` must be stored in an outer variable**: The value returned by `add()` exists only inside the `Excel.run` callback. To remove the handler later from a different call, store `eventResult` in a module-level or closure variable before `sync()`.

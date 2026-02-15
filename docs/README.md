# Informary

Informary is a browser forms data marshalling library that provides two-way synchronization between HTML form elements and JavaScript object trees. It uses declarative `data-i-*` attributes on form elements to define the mapping, and includes transaction storage, crash recovery, and undo/redo capabilities.

## Core Concepts

### Data Attributes

Informary discovers form elements by their `data-i-*` HTML attributes. Every element that participates in marshalling must have at minimum `data-i-form` and `data-i-datum`:

```html
<input type="text"
    data-i-form="InspectionForm"
    data-i-datum="Header.Inspector"
    value="">
```

- **`data-i-form`** identifies which Informary instance owns this element. It must match the `Form` setting passed to the constructor.
- **`data-i-datum`** is a dot-notation path into the JavaScript object tree. The path `Header.Inspector` maps to `{ Header: { Inspector: "value" } }`.

### Two-Way Marshalling

**Form to Data** reads every matching `input`, `select`, and `textarea` in the DOM and populates a JavaScript object:

```javascript
let record = {};
informary.marshalFormToData(record, () =>
{
    // record now contains the form data as a nested object
});
```

**Data to Form** takes a JavaScript object and pushes values into the matching DOM elements:

```javascript
informary.marshalDataToForm(serverData, () =>
{
    // form fields are now populated
});
```

### Nested Objects

Dot-notation paths automatically create nested object structures. Given these form elements:

```html
<input data-i-form="MyForm" data-i-datum="Header.WorkDate" value="2024-01-15">
<input data-i-form="MyForm" data-i-datum="Header.Location.Description" value="I5 Milepost 214">
<input data-i-form="MyForm" data-i-datum="Header.Location.Station" value="Station 114+48">
```

Marshalling produces:

```json
{
    "Header": {
        "WorkDate": "2024-01-15",
        "Location": {
            "Description": "I5 Milepost 214",
            "Station": "Station 114+48"
        }
    }
}
```

### Array Containers

For repeated form sections (table rows, dynamic lists), use `data-i-container` and `data-i-index`:

```html
<input data-i-form="MyForm" data-i-datum="Name"
    data-i-container="Personnel" data-i-index="0" value="Alice">
<input data-i-form="MyForm" data-i-datum="Name"
    data-i-container="Personnel" data-i-index="1" value="Bob">
```

This produces:

```json
{
    "Personnel": [
        { "Name": "Alice" },
        { "Name": "Bob" }
    ]
}
```

### GUID Tracking

The optional `data-i-guid` attribute assigns a unique identifier to each element. This allows Informary to track which elements have been added or deleted between snapshots, enabling fine-grained undo/redo at the element level.

```html
<input data-i-form="MyForm" data-i-datum="Name"
    data-i-container="Personnel" data-i-index="0"
    data-i-guid="a1b2c3" value="Alice">
```

## Getting Started

### 1. Install

```bash
npm install informary
```

Or include the built script directly in your HTML:

```html
<script src="dist/informary.min.js"></script>
```

### 2. Tag Your Form Elements

Add `data-i-form` and `data-i-datum` attributes to every input, select, and textarea:

```html
<form>
    <input type="text" data-i-form="SampleForm" data-i-datum="Header.WorkDate">
    <input type="text" data-i-form="SampleForm" data-i-datum="Header.Inspector">
    <textarea data-i-form="SampleForm" data-i-datum="Notes"></textarea>
    <select data-i-form="SampleForm" data-i-datum="Status">
        <option value="open">Open</option>
        <option value="closed">Closed</option>
    </select>
</form>
```

### 3. Initialize Informary

```javascript
const Informary = require('informary');

let informary = new Informary(
{
    Form: 'SampleForm',
    User: 42,
    UndoLevels: 25,
    jQuery: jQuery
});
```

### 4. Load Data Into the Form

```javascript
let serverData = { Header: { WorkDate: '2024-01-15', Inspector: 'James Smith' } };

// Check for crash recovery before loading
let recoveryState = informary.checkRecoveryState(serverData);

if (recoveryState)
{
    // There are unsaved changes from a previous session
    // Show a recovery prompt to the user, then either:
    informary.restoreRecoveryScenarioData(() => { /* restored */ });
    // or continue with fresh data:
    // informary.clearRecoveryScenarioData();
}

// Marshal server data into the form
informary.marshalDataToForm(serverData, () =>
{
    informary.storeSourceData(serverData);
    informary.snapshotDataInitial();
});
```

### 5. Snapshot on User Edits

Call `snapshotData()` periodically (e.g. on blur, on timer, on save) to create undo checkpoints:

```javascript
document.addEventListener('change', () =>
{
    informary.snapshotData();
});
```

### 6. Undo and Redo

```javascript
// Undo
informary.revertToPreviousSnapshot((pSuccess) =>
{
    console.log('Undo result:', pSuccess);
});

// Redo
informary.reapplyNextRevertedSnapshot((pSuccess) =>
{
    console.log('Redo result:', pSuccess);
});
```

### 7. Read Data for Submission

```javascript
let record = {};
informary.marshalFormToData(record, () =>
{
    // POST record to server
    fetch('/api/save', { method: 'POST', body: JSON.stringify(record) });
});
```

## Non-HTML State

Informary supports storing programmatic state that has no corresponding DOM element. This state is automatically merged into the marshalled record under the `__InformaryNonHTMLState` key:

```javascript
// Set non-HTML state
informary.nonFormData.calculatedTotal = 1500;
informary.nonFormData.validationPassed = true;

// When marshalling, this is included automatically
let record = {};
informary.marshalFormToData(record, () =>
{
    console.log(record.__InformaryNonHTMLState.calculatedTotal); // 1500
});
```

## Storage Architecture

Informary uses localStorage (or a pluggable storage provider) to persist form state across page loads and browser crashes.

**Storage keys** are structured to isolate data by user, context, and GUID:

```
Informary_Data_User[42]_ValueType[Recovery]_Context[InspectionForm]_ContextGUID[0x00001]
```

**Index keys** track timestamps for each stored value:

```
Informary_Index_User[42]_ValueType[Recovery]
```

Three value types are used:

| Value Type | Purpose |
|-----------|---------|
| `Source` | The original data loaded from the server |
| `Recovery` | The most recent form state snapshot |
| `RecoveryScenario` | Diff data when crash recovery is detected |

### Custom Storage Providers

Replace localStorage with any key-value store:

```javascript
informary.setStorageProvider(
{
    setItem: (key, value) => { /* your impl */ },
    getItem: (key) => { /* your impl */ },
    removeItem: (key) => { /* your impl */ }
});
```

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `Form` | `String` | `'UNSET_HTML_FORM_ID'` | Form identifier matching `data-i-form` attributes |
| `User` | `Number` | `0` | User identifier for storage key isolation |
| `UndoLevels` | `Number` | `25` | Maximum undo/redo snapshot depth |
| `DebugLog` | `Boolean` | `false` | Enable verbose console logging |
| `jQuery` | `Function` | `window.jQuery` | jQuery library reference |
| `__VirtualDOM` | `Object` | `window` | Virtual DOM for unit testing |

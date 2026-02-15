# Usage Lifecycle

The diagram below shows the expected usage flow for Informary in a typical form-driven application. It covers the full cycle from loading server data, through editing and snapshotting, to reading data back for submission.

![Informary Usage Lifecycle](https://github.com/stevenvelozo/informary/raw/master/diagrams/ComplexFlow.png)

## Lifecycle Steps

### 1. Download Form Data From Server

Fetch the record data from your API. This becomes the `ServerData` object that drives the rest of the flow.

### 2. Check For a Recovery Scenario

Before loading data into the form, call `checkRecoveryState(ServerData)` to detect whether the browser has unsaved changes from a previous session (e.g. a crash, accidental tab close, or network loss).

```javascript
let recoveryState = informary.checkRecoveryState(serverData);
```

If `recoveryState` is `false`, there is no recovery data and you proceed to marshal the server data into the form.

### 3. Handle Recovery Decision

If recovery data exists, present the user with a choice:

- **Restore Lost Changes** — Call `restoreRecoveryScenarioData(callback)` to push the recovered form state back into the DOM
- **Discard Recovery** — Call `clearRecoveryScenarioData()` and proceed with the fresh server data

### 4. Marshal Server Data to Form

Push the server data into the HTML form elements:

```javascript
informary.marshalDataToForm(serverData, () =>
{
    // Form is now populated
});
```

### 5. Store Initial Snapshots

After the form is populated, store the source data and create the initial undo checkpoint:

```javascript
informary.storeSourceData(serverData);
informary.snapshotDataInitial();
```

### 6. User Edits Form Data

As the user makes changes, create snapshots periodically. Each call to `snapshotData()` only stores a checkpoint if the form data has actually changed:

```javascript
informary.snapshotData();
```

### 7. Undo and Redo

At any point during editing, the user can step backward or forward through their edit history:

```javascript
// Undo
informary.revertToPreviousSnapshot((pSuccess) => { });

// Redo
informary.reapplyNextRevertedSnapshot((pSuccess) => { });
```

### 8. Get Data for Posting to Server

When the user is ready to save, marshal the form back into an object and send it to the server:

```javascript
let record = {};
informary.marshalFormToData(record, () =>
{
    // POST record to your API
});
```

# Informary

A dependency-free browser forms data marshalling library with:

* automatic marshalling of HTML data back and forth to tree Javascript objescts based on well-formed data tags
* transaction storage and snapshots for offline use leveraging browser localStorage
* undo and redo rings inside the context of the current transaction
* field-level deltas for diffs on changes within the form in the context of the current transaction

![Complex Flow](https://github.com/stevenvelozo/informary/raw/master/diagrams/ComplexFlow.png)

## Building

`npm run build`


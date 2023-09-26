"use strict";

(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }
    g.Informary = f();
  }
})(function () {
  var define, module, exports;
  return function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;
            if (!f && c) return c(i, !0);
            if (u) return u(i, !0);
            var a = new Error("Cannot find module '" + i + "'");
            throw a.code = "MODULE_NOT_FOUND", a;
          }
          var p = n[i] = {
            exports: {}
          };
          e[i][0].call(p.exports, function (r) {
            var n = e[i][1][r];
            return o(n || r);
          }, p, p.exports, r, e, n, t);
        }
        return n[i].exports;
      }
      for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
      return o;
    }
    return r;
  }()({
    1: [function (require, module, exports) {
      /**
      * Cache data structure with:
      *  - enumerable items
      *  - unique hash item access (if none is passed in, one is generated)
      *  - size (length) expiration
      *  - controllable expiration (e.g. keep in cache longer if older/less likely to change)
      *  - time-based expiration
      *  - custom expiration based on passed-in function
      *
      * Also:
      *  - built to work well with browserify
      *  - no dependencies at all
      *  - pet friendly
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @module CashMoney
      */

      /**
      * Quality Cache Goodness
      *
      * @class CashMoney
      * @constructor
      */

      const libLinkedList = require("./LinkedList.js");
      class CashMoney {
        constructor() {
          // The map of node objects by hash because Reasons.
          this._HashMap = {};
          this._List = new libLinkedList();

          // If the list gets over maxLength, we will automatically remove nodes on insertion.
          this.maxLength = 0;

          // If cache entries get over this age, they are removed with prune
          this.maxAge = 0;
        }

        // Add (or update) a node in the cache
        put(pData, pHash) {
          // If the hash of the record exists
          if (this._HashMap.hasOwnProperty(pHash)) {
            // Just update the hashed records datum
            this._HashMap[pHash].Datum = pData;
            return this._HashMap[pHash].Datum;
          }
          let tmpNode = this._List.push(pData, pHash);
          this._HashMap[tmpNode.Hash] = tmpNode;

          // Automatically prune if over length, but only prune this nodes worth.
          if (this.maxLength > 0 && this._List.length > this.maxLength) {
            // Pop it off the head of the list
            tmpNode = this._List.pop();
            // Also remove it from the hashmap
            delete this._HashMap[tmpNode.Hash];
          }

          // Now some expiration properties on the node metadata... namely the birthdate in ms of the node
          tmpNode.Metadata.Created = +new Date();
          return tmpNode.Datum;
        }

        // Reinvigorate a node based on hash, updating the timestamp and moving it to the head of the list (also removes custom metadata)
        touch(pHash) {
          if (!this._HashMap.hasOwnProperty(pHash)) return false;

          // Get the old node out of the list
          let tmpNode = this._List.remove(this._HashMap[pHash]);
          // Remove it from the hash map
          delete this._HashMap[pHash];

          // Now put it back, fresh.
          return this.put(tmpNode.Datum, tmpNode.Hash);
        }

        // Expire a cached record based on hash
        expire(pHash) {
          if (!this._HashMap.hasOwnProperty(pHash)) return false;
          let tmpNode = this._HashMap[pHash];

          // Remove it from the list of cached records
          tmpNode = this._List.remove(tmpNode);
          // Also remove it from the hashmap
          delete this._HashMap[tmpNode.Hash];

          // Return it in case the consumer wants to do anything with it
          return tmpNode;
        }

        // Prune records from the cached set based on maxAge
        pruneBasedOnExpiration(fComplete, pRemovedRecords) {
          let tmpRemovedRecords = typeof pRemovedRecords === 'undefined' ? [] : pRemovedRecords;
          if (this.maxAge < 1) return fComplete(tmpRemovedRecords);

          // Now enumerate each record and remove any that are expired
          let tmpNow = +new Date();
          let tmpKeys = Object.keys(this._HashMap);
          for (let i = 0; i < tmpKeys.length; i++) {
            // Expire the node if it is older than max age milliseconds
            if (tmpNow - this._HashMap[tmpKeys[i]].Metadata.Created >= this.maxAge) tmpRemovedRecords.push(this.expire(tmpKeys[i]));
          }
          fComplete(tmpRemovedRecords);
        }

        // Prune records from the cached set based on maxLength
        pruneBasedOnLength(fComplete, pRemovedRecords) {
          let tmpRemovedRecords = typeof pRemovedRecords === 'undefined' ? [] : pRemovedRecords;

          // Pop records off until we have reached maxLength unless it's 0
          if (this.maxLength > 0) while (this._List.length > this.maxLength) tmpRemovedRecords.push(this._List.pop());
          return fComplete(tmpRemovedRecords);
        }

        // Prune records from the cached set based on passed in pPruneFunction(pDatum, pHash, pNode) -- returning true expires it
        pruneCustom(fComplete, fPruneFunction, pRemovedRecords) {
          let tmpRemovedRecords = typeof pRemovedRecords === 'undefined' ? [] : pRemovedRecords;
          let tmpKeys = Object.keys(this._HashMap);
          for (let i = 0; i < tmpKeys.length; i++) {
            let tmpNode = this._HashMap[tmpKeys[i]];
            // Expire the node if the passed in function returns true
            if (fPruneFunction(tmpNode.Datum, tmpNode.Hash, tmpNode)) tmpRemovedRecords.push(this.expire(tmpKeys[i]));
          }
          fComplete(tmpRemovedRecords);
        }

        // Prune the list down to the asserted rules (max age then max length if still too long)
        prune(fComplete) {
          let tmpRemovedRecords = [];

          // If there are no cached records, we are done.
          if (this._List.length < 1) return fComplete(tmpRemovedRecords);

          // Now prune based on expiration time
          this.pruneBasedOnExpiration(fExpirationPruneComplete => {
            // Now prune based on length, then return the removed records in the callback.
            this.pruneBasedOnLength(fComplete, tmpRemovedRecords);
          }, tmpRemovedRecords);
        }

        // Read a datum by hash from the cache
        read(pHash) {
          if (!this._HashMap.hasOwnProperty(pHash)) return false;
          return this._HashMap[pHash].Datum;
        }

        // Get a low level node (including metadata statistics) by hash from the cache
        getNode(pHash) {
          if (!this._HashMap.hasOwnProperty(pHash)) return false;
          return this._HashMap[pHash];
        }
      }
      module.exports = CashMoney;
    }, {
      "./LinkedList.js": 3
    }],
    2: [function (require, module, exports) {
      /**
      * Double Linked List Node
      *
      * @author Steven Velozo <steven@velozo.com>
      * @module CashMoney
      */

      /**
      * Linked List Node Prototype
      *
      * @class LinkedListNode
      * @constructor
      */

      class LinkedListNode {
        constructor() {
          this.Hash = false;
          this.Datum = false;

          // This is where expiration and other elements are stored;
          this.Metadata = {};
          this.LeftNode = false;
          this.RightNode = false;

          // To allow safe specialty operations on nodes
          this.__ISNODE = true;
        }
      }
      module.exports = LinkedListNode;
    }, {}],
    3: [function (require, module, exports) {
      "use strict";

      /**
      * Simple double linked list to hold the cache entries in, in order.
      *
      * @author Steven Velozo <steven@velozo.com>
      * @module FeeFiFo
      */
      const libLinkedListNode = require('./LinkedList-Node.js');

      /**
      * Quality Cache Goodness
      *
      * @class CashMoney
      * @constructor
      */

      class LinkedList {
        constructor() {
          // Total number of nodes ever processed by this ADT
          this.totalNodes = 0;

          // The length of the set of nodes currently in the list
          this.length = 0;
          this.head = false;
          this.tail = false;
        }

        // Create a node object.
        initializeNode(pDatum, pHash) {
          // Don't allow undefined to be added to the list because of reasons
          if (typeof pDatum === 'undefined') return false;
          this.totalNodes++;

          // Get (or create) a unique hash
          let tmpHash = typeof pHash != 'undefined' ? pHash : "NODE[".concat(this.totalNodes, "]");
          let tmpNode = new libLinkedListNode();
          tmpNode.Hash = tmpHash;
          tmpNode.Datum = pDatum;
          return tmpNode;
        }

        // Add a node to the end (right of tail) of the list.
        append(pDatum, pHash) {
          // TODO: Should we check if pDatum is actually a node and do the "right" thing?
          let tmpNode = this.initializeNode(pDatum, pHash);
          if (!tmpNode) return false;

          // The list just got longer!
          this.length++;

          // If the list was empty, create a new list from it (it isn't possible to have a tail with no head)
          if (this.length == 1) {
            this.head = tmpNode;
            this.tail = tmpNode;
            return tmpNode;
          }
          this.tail.RightNode = tmpNode;
          tmpNode.LeftNode = this.tail;
          this.tail = tmpNode;
          return tmpNode;
        }

        // Append to tail of list (FIFO)
        push(pDatum, pHash) {
          return this.append(pDatum, pHash);
        }

        // Add a node to the beginning (left of head) of the list.
        prepend(pDatum, pHash) {
          // TODO: Should we check if pDatum is actually a node and do the "right" thing?
          let tmpNode = this.initializeNode(pDatum, pHash);
          if (!tmpNode) return false;

          // The list just got longer!
          this.length++;

          // If the list was empty, create a new list from it (it isn't possible to have a tail with no head)
          if (this.length == 1) {
            this.head = tmpNode;
            this.tail = tmpNode;
            return tmpNode;
          }
          this.head.LeftNode = tmpNode;
          tmpNode.RightNode = this.head;
          this.head = tmpNode;
          return tmpNode;
        }

        // Remove a node from the list
        remove(pNode) {
          if (typeof pNode === 'undefined') return false;
          if (!pNode.__ISNODE) return false;
          this.length--;

          // Last element in list.  Empty it out.
          if (this.length < 1) {
            this.head = false;
            this.tail = false;
            return pNode;
          }

          // It's somewhere in the middle, surgically remove it.
          if (pNode.LeftNode && pNode.RightNode) {
            pNode.LeftNode.RightNode = pNode.RightNode;
            pNode.RightNode.LeftNode = pNode.LeftNode;
            pNode.RightNode = false;
            pNode.LeftNode = false;
            return pNode;
          }

          // It's the tail
          if (pNode.LeftNode) {
            pNode.LeftNode.RightNode = false;
            this.tail = pNode.LeftNode;
            pNode.LeftNode = false;
            return pNode;
          }

          // It must be the head
          pNode.RightNode.LeftNode = false;
          this.head = pNode.RightNode;
          pNode.RightNode = false;
          return pNode;
        }

        // Remove the head of the list (FIFO)
        pop() {
          return this.remove(this.head);
        }

        // Enumerate over each node IN ORDER, running the function fAction(pDatum, pHash, fCallback) then calling the function fComplete callback when done
        each(fAction, fComplete) {
          if (this.length < 1) return fComplete();
          let tmpNode = false;
          let fIterator = pError => {
            // If the user passed in a callback with an error, call their callback with the error
            if (pError) return fComplete(pError);

            // If there is no node, this must be the initial run.
            if (!tmpNode) tmpNode = this.head;
            // Check if we are at the tail of the list
            else if (!tmpNode.RightNode) return fComplete();
            // Proceed to the next node
            else tmpNode = tmpNode.RightNode;

            // Call the actual action
            // I hate this pattern because long tails eventually cause stack overflows.
            fAction(tmpNode.Datum, tmpNode.Hash, fIterator);
          };

          // Now kick off the iterator
          return fIterator();
        }

        // Seek a specific node, 0 is the index of the first node.
        seek(pNodeIndex) {
          if (!pNodeIndex) return false;
          if (this.length < 1) return false;
          if (pNodeIndex >= this.length) return false;
          let tmpNode = this.head;
          for (let i = 0; i < pNodeIndex; i++) {
            tmpNode = tmpNode.RightNode;
          }
          return tmpNode;
        }
      }
      module.exports = LinkedList;
    }, {
      "./LinkedList-Node.js": 2
    }],
    4: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = void 0;
      var _utils = require("./utils.js");
      const addedDiff = (lhs, rhs) => {
        if (lhs === rhs || !(0, _utils.isObject)(lhs) || !(0, _utils.isObject)(rhs)) return {};
        return Object.keys(rhs).reduce((acc, key) => {
          if ((0, _utils.hasOwnProperty)(lhs, key)) {
            const difference = addedDiff(lhs[key], rhs[key]);
            if ((0, _utils.isObject)(difference) && (0, _utils.isEmpty)(difference)) return acc;
            acc[key] = difference;
            return acc;
          }
          acc[key] = rhs[key];
          return acc;
        }, (0, _utils.makeObjectWithoutPrototype)());
      };
      var _default = addedDiff;
      exports.default = _default;
    }, {
      "./utils.js": 10
    }],
    5: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = void 0;
      var _utils = require("./utils.js");
      const deletedDiff = (lhs, rhs) => {
        if (lhs === rhs || !(0, _utils.isObject)(lhs) || !(0, _utils.isObject)(rhs)) return {};
        return Object.keys(lhs).reduce((acc, key) => {
          if ((0, _utils.hasOwnProperty)(rhs, key)) {
            const difference = deletedDiff(lhs[key], rhs[key]);
            if ((0, _utils.isObject)(difference) && (0, _utils.isEmpty)(difference)) return acc;
            acc[key] = difference;
            return acc;
          }
          acc[key] = undefined;
          return acc;
        }, (0, _utils.makeObjectWithoutPrototype)());
      };
      var _default = deletedDiff;
      exports.default = _default;
    }, {
      "./utils.js": 10
    }],
    6: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = void 0;
      var _added = _interopRequireDefault(require("./added.js"));
      var _deleted = _interopRequireDefault(require("./deleted.js"));
      var _updated = _interopRequireDefault(require("./updated.js"));
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
          default: obj
        };
      }
      const detailedDiff = (lhs, rhs) => ({
        added: (0, _added.default)(lhs, rhs),
        deleted: (0, _deleted.default)(lhs, rhs),
        updated: (0, _updated.default)(lhs, rhs)
      });
      var _default = detailedDiff;
      exports.default = _default;
    }, {
      "./added.js": 4,
      "./deleted.js": 5,
      "./updated.js": 9
    }],
    7: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = void 0;
      var _utils = require("./utils.js");
      const diff = (lhs, rhs) => {
        if (lhs === rhs) return {}; // equal return no diff

        if (!(0, _utils.isObject)(lhs) || !(0, _utils.isObject)(rhs)) return rhs; // return updated rhs

        const deletedValues = Object.keys(lhs).reduce((acc, key) => {
          if (!(0, _utils.hasOwnProperty)(rhs, key)) {
            acc[key] = undefined;
          }
          return acc;
        }, (0, _utils.makeObjectWithoutPrototype)());
        if ((0, _utils.isDate)(lhs) || (0, _utils.isDate)(rhs)) {
          if (lhs.valueOf() == rhs.valueOf()) return {};
          return rhs;
        }
        return Object.keys(rhs).reduce((acc, key) => {
          if (!(0, _utils.hasOwnProperty)(lhs, key)) {
            acc[key] = rhs[key]; // return added r key

            return acc;
          }
          const difference = diff(lhs[key], rhs[key]); // If the difference is empty, and the lhs is an empty object or the rhs is not an empty object

          if ((0, _utils.isEmptyObject)(difference) && !(0, _utils.isDate)(difference) && ((0, _utils.isEmptyObject)(lhs[key]) || !(0, _utils.isEmptyObject)(rhs[key]))) return acc; // return no diff

          acc[key] = difference; // return updated key

          return acc; // return updated key
        }, deletedValues);
      };
      var _default = diff;
      exports.default = _default;
    }, {
      "./utils.js": 10
    }],
    8: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      Object.defineProperty(exports, "addedDiff", {
        enumerable: true,
        get: function get() {
          return _added.default;
        }
      });
      Object.defineProperty(exports, "deletedDiff", {
        enumerable: true,
        get: function get() {
          return _deleted.default;
        }
      });
      Object.defineProperty(exports, "detailedDiff", {
        enumerable: true,
        get: function get() {
          return _detailed.default;
        }
      });
      Object.defineProperty(exports, "diff", {
        enumerable: true,
        get: function get() {
          return _diff.default;
        }
      });
      Object.defineProperty(exports, "updatedDiff", {
        enumerable: true,
        get: function get() {
          return _updated.default;
        }
      });
      var _diff = _interopRequireDefault(require("./diff.js"));
      var _added = _interopRequireDefault(require("./added.js"));
      var _deleted = _interopRequireDefault(require("./deleted.js"));
      var _updated = _interopRequireDefault(require("./updated.js"));
      var _detailed = _interopRequireDefault(require("./detailed.js"));
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
          default: obj
        };
      }
    }, {
      "./added.js": 4,
      "./deleted.js": 5,
      "./detailed.js": 6,
      "./diff.js": 7,
      "./updated.js": 9
    }],
    9: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = void 0;
      var _utils = require("./utils.js");
      const updatedDiff = (lhs, rhs) => {
        if (lhs === rhs) return {};
        if (!(0, _utils.isObject)(lhs) || !(0, _utils.isObject)(rhs)) return rhs;
        if ((0, _utils.isDate)(lhs) || (0, _utils.isDate)(rhs)) {
          if (lhs.valueOf() == rhs.valueOf()) return {};
          return rhs;
        }
        return Object.keys(rhs).reduce((acc, key) => {
          if ((0, _utils.hasOwnProperty)(lhs, key)) {
            const difference = updatedDiff(lhs[key], rhs[key]); // If the difference is empty, and the lhs is an empty object or the rhs is not an empty object

            if ((0, _utils.isEmptyObject)(difference) && !(0, _utils.isDate)(difference) && ((0, _utils.isEmptyObject)(lhs[key]) || !(0, _utils.isEmptyObject)(rhs[key]))) return acc; // return no diff

            acc[key] = difference;
            return acc;
          }
          return acc;
        }, (0, _utils.makeObjectWithoutPrototype)());
      };
      var _default = updatedDiff;
      exports.default = _default;
    }, {
      "./utils.js": 10
    }],
    10: [function (require, module, exports) {
      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.makeObjectWithoutPrototype = exports.isObject = exports.isEmptyObject = exports.isEmpty = exports.isDate = exports.hasOwnProperty = void 0;
      const isDate = d => d instanceof Date;
      exports.isDate = isDate;
      const isEmpty = o => Object.keys(o).length === 0;
      exports.isEmpty = isEmpty;
      const isObject = o => o != null && typeof o === 'object';
      exports.isObject = isObject;
      const hasOwnProperty = function hasOwnProperty(o) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        return Object.prototype.hasOwnProperty.call(o, ...args);
      };
      exports.hasOwnProperty = hasOwnProperty;
      const isEmptyObject = o => isObject(o) && isEmpty(o);
      exports.isEmptyObject = isEmptyObject;
      const makeObjectWithoutPrototype = () => Object.create(null);
      exports.makeObjectWithoutPrototype = makeObjectWithoutPrototype;
    }, {}],
    11: [function (require, module, exports) {
      /**
      * @license MIT
      * @author <steven@velozo.com>
      */

      /**
      * Informary browser shim loader
      */

      // Load the informary module into the browser global automatically.
      var libInformary = require('./Informary.js');
      if (typeof window === 'object') {
        window.Informary = libInformary;
      }
      module.exports = libInformary;
    }, {
      "./Informary.js": 13
    }],
    12: [function (require, module, exports) {
      /**
      * @license MIT
      * @author <steven@velozo.com>
      */

      /**
      * Informary Logging
      *
      * @class InformaryLog
      */

      class InformaryLog {
        constructor(pSettings) {
          this._Settings = pSettings;
        }
        writeConsole(pLevel, pMessage, pObject) {
          // Write the message
          console.log('[' + pLevel + '] (' + this._Settings.Form + ') ' + pMessage);

          // Write out the object if it is passed in
          if (typeof pObject !== 'undefined') {
            console.log(JSON.stringify(pObject, null, 4));
          }
        }
        trace(pMessage, pObject) {
          this.writeConsole('TRACE', pMessage, pObject);
        }
        debug(pMessage, pObject) {
          this.writeConsole('DEBUG', pMessage, pObject);
        }
        info(pMessage, pObject) {
          this.writeConsole('INFO', pMessage, pObject);
        }
        warning(pMessage, pObject) {
          this.writeConsole('WARNING', pMessage, pObject);
        }
        error(pMessage, pObject) {
          this.writeConsole('ERROR', pMessage, pObject);
        }

        // Log the current date and time, well formatted (with Moment-Timezone)
        logTime(pMessage) {
          let tmpMessage = typeof pMessage !== 'undefined' ? pMessage : 'Time';
          let tmpDate = new Date();
          this.info(tmpMessage + ': ' + tmpDate.toString());
        }

        // Get a timestamp
        getTimeStamp() {
          return +new Date();
        }
        getTimeDelta(pTimeStamp) {
          let tmpEndTime = +new Date();
          return tmpEndTime - pTimeStamp;
        }

        // Log the delta between a timestamp, and now with a message
        logTimeDelta(pTimeStamp, pMessage) {
          let tmpMessage = typeof pMessage !== 'undefined' ? pMessage : 'Time Measurement';
          let tmpEndTime = +new Date();
          let tmpOperationTime = tmpEndTime - pTimeStamp;
          this.info(tmpMessage + ' (' + tmpOperationTime + 'ms)');
        }
      }
      module.exports = InformaryLog;
    }, {}],
    13: [function (require, module, exports) {
      /**
      * @license MIT
      * @author <steven@velozo.com>
      */

      let libObjectDiff = require('deep-object-diff');
      let libCacheTraxx = require('cachetrax');

      /**
      * Informary browser sync library
      *
      * @class Informary
      */
      class Informary {
        constructor(pSettings, pContext, pContextGUID) {
          this._Dependencies = {};
          if (typeof window == 'object' && typeof window.jQuery == 'function') {
            this._Dependencies.jqueryLibrary = window.jQuery;
          } else if (pSettings.jQuery) {
            // jQuery was passed in as part of the settings
            this._Dependencies.jqueryLibrary = pSettings.jQuery;
          } else {
            throw new Error('No jQuery found in the window object or as a property of pSettings -- informary cannot function without jQuery.');
          }
          //		this._Dependencies.jqueryLibrary = require('jquery');

          // Adding a container for non-html state to be stored in, which will be marshalled into and out of the passed in FormData.
          this._NonHTMLState = {};
          this._NonHTMLStateProperty = "__InformaryNonHTMLState";
          this._Settings = typeof pSettings === 'object' ? pSettings : {
            // The form we are dealing with (this is a hash set on the form itself)
            Form: 'UNSET_HTML_FORM_ID',
            User: 0,
            // The number of undo levels available
            UndoLevels: 25,
            // If this is true, show a whole lotta logs
            DebugLog: false
          };
          if (this._Settings.__VirtualDOM) {
            // If a virtual dom was passed in for unit tests, use that.
            this._Dependencies.jquery = this._Dependencies.jqueryLibrary(this._Settings.__VirtualDOM);
          } else {
            this._Dependencies.jquery = this._Dependencies.jqueryLibrary;
          }
          if (!this._Settings.User) {
            // If no user was passed in, set a default of 0
            this._Settings.User = 0;
          }
          if (!this._Settings.Form) {
            this._Settings.Form = 'UNSET_HTML_FORM_ID';
          }

          // This has behaviors similar to bunyan, for consistency
          this._Log = new (require('./Informary-Log.js'))(this._Settings);
          this.log = this._Log;

          // This is lazily set so unit tests can set an external provider for harnesses
          this._LocalStorage = null;
          this._UndoKeys = [];
          this._UndoBuffer = new libCacheTraxx();
          // Default to 25 undo levels if it isn't passed in via settings
          this._UndoBuffer.maxLength = this._Settings.UndoLevels ? this._Settings.UndoLevels : 25;
          this._RedoKeys = [];
          this._RedoBuffer = new libCacheTraxx();
          this._RedoBuffer.maxLength = this._UndoBuffer.maxLength;

          // The initially loaded document state (filled out when pushed to form)
          this._SourceDocumentState = false;
          // The latest current document state
          this._CurrentDocumentState = false;

          // If no context is passed in, use `Context_0`
          // This could cause undo/redo leakage.
          this._Context = pContext ? pContext.toString() : 'InformaryDefaultContext';
          this._ContextGUID = pContextGUID ? pContextGUID.toString() : '0x000000001';
        }

        /******************************************************
         * Storage Provider
         * --
         * This could be abstracted to another class
         */
        setStorageProvider(pStorageProvider) {
          this._LocalStorage = pStorageProvider;
        }
        checkStorageProvider() {
          // When running in a browser, this likely won't be set.  If it isn't,
          if (!this._LocalStorage) {
            this._LocalStorage = window.localStorage;
            if (!this._LocalStorage) {
              const cache = {};
              this._LocalStorage = {
                setItem: (key, value) => {
                  cache[key] = value;
                },
                getItem: key => {
                  return cache[key];
                },
                removeItem: key => {
                  delete cache[key];
                }
              };
            }
          }
        }
        getIndexKey(pValueType) {
          return "Informary_Index_User[".concat(this._Settings.User.toString(), "]_ValueType[").concat(pValueType, "]");
        }
        getStorageKey(pValueType) {
          return "Informary_Data_User[".concat(this._Settings.User.toString(), "]_ValueType[").concat(pValueType, "]_Context[").concat(this._Context, "]_ContextGUID[").concat(this._ContextGUID, "]");
        }

        // Read the whole index
        readIndex(pValueType) {
          this.checkStorageProvider();
          let tmpIndex = false;
          let tmpData = this._LocalStorage.getItem(this.getIndexKey(pValueType));
          if (tmpData) {
            try {
              tmpIndex = JSON.parse(tmpData);
            } catch (pError) {
              this.log.error("Error parsing local storage index key [".concat(this.getIndexKey(pValueType), "]"));
            }
          }
          if (!tmpIndex) {
            tmpIndex = {
              IndexCreateTime: Date.now(),
              IndexUser: this._Settings.User
            };
          }
          tmpIndex.IndexLastReadTime = Date.now();
          return tmpIndex;
        }

        // Read just the record key for the index
        readIndexValue(pValueType) {
          let tmpIndex = this.readIndex(pValueType);
          let tmpIndexKeyValue = tmpIndex[this.getStorageKey(pValueType)];

          // Rather than return undefined, return false if it's a miss
          return tmpIndexKeyValue ? tmpIndexKeyValue : false;
        }

        // Touch the index for a value type
        touchIndex(pValueType) {
          this.checkStorageProvider();
          let tmpIndex = this.readIndex(pValueType);
          let tmpKey = this.getStorageKey(pValueType);
          tmpIndex[tmpKey] = {
            Time: Date.now(),
            ValueType: pValueType,
            User: this._Settings.User,
            Context: this._Context,
            ContextGUID: this._ContextGUID
          };

          // This relies on the readIndex above to initialize the localstorage provider
          this._LocalStorage.setItem(this.getIndexKey(pValueType), JSON.stringify(tmpIndex));
        }
        readData(pValueType) {
          // Check that the storage provider is initialized
          this.checkStorageProvider();
          let tmpData = this._LocalStorage.getItem(this.getStorageKey(pValueType));
          if (tmpData) {
            try {
              tmpData = JSON.parse(tmpData);
            } catch (pError) {
              this.log.error("Error parsing local storage key [".concat(this.getStorageKey(pValueType), "]"));
              tmpData = false;
            }
          } else {
            tmpData = false;
          }
          return tmpData;
        }
        writeData(pValueType, pData) {
          // Check that the storage provider is initialized
          this.checkStorageProvider();

          // Touch the index with a timestamp for the value
          this.touchIndex(pValueType);

          // set the actual item
          this._LocalStorage.setItem(this.getStorageKey(pValueType), JSON.stringify(pData));
        }
        deleteData(pValueType) {
          // Check that the storage provider is initialized
          this.checkStorageProvider();

          // Touch the index with a timestamp for the value.  Should we tell it it's a delete operation?  Hmmm..
          this.touchIndex(pValueType);

          // set the actual item
          this._LocalStorage.removeItem(this.getStorageKey(pValueType));
        }
        /*
         * End of Storage Provider section
         ******************************************************/

        getValueAtAddress(pObject, pAddress) {
          // Make sure pObject is an object
          if (!typeof pObject === 'object') return false;
          // Make sure pAddress is a string
          if (!typeof pAddress === 'string') return false;
          let tmpSeparatorIndex = pAddress.indexOf('.');
          if (tmpSeparatorIndex === -1) {
            // Now is the time to return the value in the address
            return pObject[pAddress];
          } else {
            let tmpSubObjectName = pAddress.substring(0, tmpSeparatorIndex);
            let tmpNewAddress = pAddress.substring(tmpSeparatorIndex + 1);

            // If there is an object property already named for the sub object, but it isn't an object
            // then the system can't set the value in there.  Error and abort!
            if (pObject.hasOwnProperty(tmpSubObjectName) && typeof pObject[tmpSubObjectName] !== 'object') {
              return false;
            } else if (pObject.hasOwnProperty(tmpSubObjectName)) {
              // If there is already a subobject pass that to the recursive thingy
              return this.getValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress);
            } else {
              // Create a subobject and then pass that
              pObject[tmpSubObjectName] = {};
              return this.getValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress);
            }
          }
        }
        setValueAtAddress(pObject, pAddress, pValue) {
          // Make sure pObject is an object
          if (!typeof pObject === 'object') return false;
          // Make sure pAddress is a string
          if (!typeof pAddress === 'string') return false;
          let tmpSeparatorIndex = pAddress.indexOf('.');
          if (tmpSeparatorIndex === -1) {
            // Now is the time to set the value in the object
            pObject[pAddress] = pValue;
            return true;
          } else {
            let tmpSubObjectName = pAddress.substring(0, tmpSeparatorIndex);
            let tmpNewAddress = pAddress.substring(tmpSeparatorIndex + 1);

            // If there is an object property already named for the sub object, but it isn't an object
            // then the system can't set the value in there.  Error and abort!
            if (pObject.hasOwnProperty(tmpSubObjectName) && typeof pObject[tmpSubObjectName] !== 'object') {
              if (!pObject.hasOwnProperty('__ERROR')) pObject['__ERROR'] = {};
              // Put it in an error object so data isn't lost
              pObject['__ERROR'][pAddress] = pValue;
              return false;
            } else if (pObject.hasOwnProperty(tmpSubObjectName)) {
              // If there is already a subobject pass that to the recursive thingy
              return this.setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
            } else {
              // Create a subobject and then pass that
              pObject[tmpSubObjectName] = {};
              return this.setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
            }
          }
        }
        setValueAtAddressInContainer(pRecordObject, pFormContainerAddress, pFormContainerIndex, pFormValueAddress, pFormValue) {
          // First see if there *is* a container object
          let tmpContainerObject = this.getValueAtAddress(pRecordObject, pFormContainerAddress);
          if (typeof pFormContainerAddress !== 'string') return false;
          let tmpFormContainerIndex = parseInt(pFormContainerIndex, 10);
          if (isNaN(tmpFormContainerIndex)) return false;
          if (typeof tmpContainerObject !== 'object' || !Array.isArray(tmpContainerObject)) {
            // Check if there is a value here and we want to store it in the "__OverwrittenData" thing
            tmpContainerObject = [];
            this.setValueAtAddress(pRecordObject, pFormContainerAddress, tmpContainerObject);
          }
          for (let i = 0; tmpContainerObject.length + i <= tmpFormContainerIndex + 1; i++) {
            // Add objects to this container until it has enough
            tmpContainerObject.push({});
          }

          // Now set the value *in* the container object
          return this.setValueAtAddress(tmpContainerObject[tmpFormContainerIndex], pFormValueAddress, pFormValue);
        }

        // Write out source data
        storeSourceData(pData) {
          return this.writeData('Source', pData);
        }

        // Write out recovery data
        storeRecoveryData(fCallback) {
          let tmpCallback = typeof fCallback == 'function' ? fCallback : () => {};
          let tmpRecoveryData = {};
          this.marshalFormToData(tmpRecoveryData, () => {
            this._RecoveryDocumentState = tmpRecoveryData;
            return tmpCallback(this.writeData('Recovery', this._RecoveryDocumentState));
          });
        }
        snapshotData() {
          let tmpNewUndoKey = Date.now().toString();

          // Check to see if there are any changes to the data to be stored
          let tmpOldRecoveryState = JSON.stringify(this._RecoveryDocumentState);
          this.storeRecoveryData(() => {
            if (tmpOldRecoveryState != JSON.stringify(this._RecoveryDocumentState)) {
              if (this._Settings.DebugLog) {
                this.log.debug("Creating recovery snapshot at [".concat(tmpNewUndoKey, "]..."));
              }

              // Destroy all data in the redo ring, because this new snapshot invalidates it.
              while (this._RedoKeys.length > 0) {
                let tmpRedoKey = this._RedoKeys.pop();
                this._RedoBuffer.expire(tmpRedoKey);
              }
              this._UndoKeys.push(tmpNewUndoKey);
              this._UndoBuffer.put(this._RecoveryDocumentState, tmpNewUndoKey);
            } else {
              if (this._Settings.DebugLog) {
                this.log.debug("Skipped creating recovery snapshot at [".concat(tmpNewUndoKey, "] because there were no changes to the recovery state..."));
              }
            }
          });
        }
        snapshotDataInitial() {
          let tmpNewUndoKey = Date.now().toString();
          if (this._UndoKeys.length > 0) {
            this.log.info("Skipping creation of initial snapshot because one already exists.");
            return false;
          }
          this.storeRecoveryData(() => {
            if (this._Settings.DebugLog) {
              this.log.debug("Creating recovery snapshot at [".concat(tmpNewUndoKey, "]..."));
            }
            this._UndoKeys.push(tmpNewUndoKey);
            this._UndoBuffer.put(this._RecoveryDocumentState, tmpNewUndoKey);
          });
          return true;
        }
        undoSnapshotCount() {
          // The initial snapshot is special to prevent confusing conditions when form data hasn't been edited.
          return this._UndoKeys.length;
        }
        redoSnapshotCount() {
          return this._RedoKeys.length;
        }
        revertToPreviousSnapshot(fCallback) {
          let tmpCallback = typeof fCallback == 'function' ? fCallback : () => {};
          if (this._UndoKeys.length < 1) {
            this.log.info("Not enough undo snapshots; skipping undo.");
            return tmpCallback(false);
          }
          let tmpSnapshotKey = this._UndoKeys.pop();
          let tmpSnapshotData = this._UndoBuffer.read(tmpSnapshotKey);
          if (tmpSnapshotData) {
            // Add it to the redo buffer
            this._RedoKeys.push(tmpSnapshotKey);
            this._RedoBuffer.put(tmpSnapshotData, tmpSnapshotKey);

            // Check if the form data matches and if so advance back one step
            let tmpCurrentFormData = {};
            this.marshalFormToData(tmpCurrentFormData, () => {
              // Remove the expired snapshot of data from the Undu buffer
              this._UndoBuffer.expire(tmpSnapshotKey);
              this.marshalDataToForm(tmpSnapshotData, () => {
                this._RecoveryDocumentState = tmpSnapshotData;
                this.log.info("Informary reverted to snapshot ID ".concat(tmpSnapshotKey));
                if (JSON.stringify(tmpCurrentFormData) == JSON.stringify(tmpSnapshotData) && this._UndoKeys.length > 0) {
                  return this.revertToPreviousSnapshot(tmpCallback);
                }
                if (this._UndoKeys.length == 0) {
                  this.log.info("Snapshot Data Depleted -- Creating Extra Undo Snapshot");
                  this.snapshotDataInitial();
                }
                return tmpCallback(true);
              });
            });
          }
          return tmpCallback(false);
        }
        reapplyNextRevertedSnapshot(fCallback) {
          let tmpCallback = typeof fCallback == 'function' ? fCallback : () => {};
          let tmpSnapshotKey = this._RedoKeys.pop();
          let tmpSnapshotData = this._RedoBuffer.read(tmpSnapshotKey);
          if (tmpSnapshotData) {
            // Add it to the undo buffer
            this._UndoKeys.push(tmpSnapshotKey);
            this._UndoBuffer.put(tmpSnapshotData, tmpSnapshotKey);

            // Remove the expired snapshot of data from the Redo buffer
            this._RedoBuffer.expire(tmpSnapshotKey);

            // Check if the form data matches and if so advance back one step
            let tmpCurrentFormData = {};
            this.marshalFormToData(tmpCurrentFormData, () => {
              this.marshalDataToForm(tmpSnapshotData, () => {
                this._RecoveryDocumentState = tmpSnapshotData;
                this.log.info("Informary reapplied snapshot ID ".concat(tmpSnapshotKey));
                if (JSON.stringify(tmpCurrentFormData) == JSON.stringify(tmpSnapshotData) && this._RedoKeys.length > 0) {
                  // If the old form data matches the applied data, roll back farther
                  return this.reapplyNextRevertedSnapshot(tmpCallback);
                }
                return tmpCallback(true);
              });
            });
          }
          return tmpCallback(false);
        }
        clearRecoveryData() {
          return this.deleteData('Recovery');
        }
        readRecoveryData() {
          return this.readData('Recovery');
        }
        restoreRecoveryScenarioData(fCallback) {
          let tmpCallback = typeof fCallback == 'function' ? fCallback : () => {};
          let tmpRecoveryScenarioData = this.readRecoveryScenario();
          if (tmpRecoveryScenarioData && tmpRecoveryScenarioData.ExistingRecovery) {
            this.marshalDataToForm(tmpRecoveryScenarioData.ExistingRecovery, () => {
              this.clearRecoveryScenarioData();
              // Store a new recovery data
              //this.storeSourceData();
              return tmpCallback(true);
            });
          }
          return tmpCallback(false);
        }
        clearRecoveryScenarioData() {
          return this.deleteData('RecoveryScenario');
        }
        storeRecoveryScenarioData(pRecoveryScenarioData) {
          return this.writeData('RecoveryScenario', pRecoveryScenarioData);
        }
        readRecoveryScenario() {
          return this.readData('RecoveryScenario');
        }

        // Checks if there is a recovery record, and detailed data about what it might be
        checkRecoveryState(pSourceData) {
          let tmpRecoveryData = {
            NewSource: pSourceData,
            ExistingSource: this.readData('Source'),
            ExistingRecovery: this.readData('Recovery')
          };
          if (!tmpRecoveryData.ExistingSource || !tmpRecoveryData.ExistingRecovery) {
            // There is either no source or no read data, so we are not in a recovery state
            return false;
          } else {
            // Now check the differences
            let tmpRecoveryDifferences = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingSource, tmpRecoveryData.ExistingRecovery);
            if (JSON.stringify(tmpRecoveryDifferences) == JSON.stringify(libObjectDiff.detailedDiff({}, {}))) {
              // No differences -- we're good for now
              return false;
            } else {
              this._Log.info("Informary found recovery data at ".concat(this.getStorageKey('Recovery'), "!"));
              // Put the recovery changes in the object for helpfulness
              tmpRecoveryData.Diffs = {};
              tmpRecoveryData.Diffs.ExistingRecovery_ExistingSource = tmpRecoveryDifferences;
              tmpRecoveryData.Diffs.ExistingSource_NewSource = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingSource, tmpRecoveryData.NewSource);
              tmpRecoveryData.Diffs.ExistingRecovery_NewSource = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingRecovery, tmpRecoveryData.NewSource);

              // Put the index data in the object for helpfulness
              tmpRecoveryData.Index = {};
              tmpRecoveryData.Index.ExistingSource = this.readIndexValue('Source');
              tmpRecoveryData.Index.ExistingRecovery = this.readIndexValue('Recovery');
              this.writeData('RecoveryScenario', tmpRecoveryData);
              return tmpRecoveryData;
            }
          }
        }
        compareCurrentStateToUndoAndRedo(fCallback) {
          let tmpCallBack = typeof fCallback === 'function' ? fCallback : () => {};
          let tmpCurrentStateData = {};
          let tmpCurrentUndoObject = {};
          let tmpCurrentRedoObject = {};
          this.marshalFormToData(tmpCurrentStateData, () => {
            let tmpCurrentStateDataJSON = JSON.stringify(tmpCurrentStateData);
            if (this._UndoKeys.length > 0) {
              let tmpCurrentUndoBufferSnapshotKey = this._UndoKeys[this._UndoKeys.length - 1];
              tmpCurrentUndoObject = this._UndoBuffer.read(tmpCurrentUndoBufferSnapshotKey);
            }
            if (this._RedoKeys.length > 0) {
              // Because there can be duplication of records in the redo buffer that may include
              // the current data in the form multiple times, we need to enumerate the redo buffer
              // until the JSON doesn't match the current data.
              let tmpFirstRedoIndexWithDifferences = this._RedoKeys.length - 1;
              for (let i = this._RedoKeys.length - 1; i >= 0; i--) {
                let tmpRedoComparisonJSON = JSON.stringify(this._RedoBuffer.read(this._RedoKeys[i]));
                if (tmpRedoComparisonJSON != tmpCurrentStateDataJSON) {
                  tmpFirstRedoIndexWithDifferences = i;
                  // Once we have found a set of redo data that doesn't match, we don't want to keep looking
                  break;
                }
              }
              tmpCurrentRedoObject = this._RedoBuffer.read(this._RedoKeys[tmpFirstRedoIndexWithDifferences]);
            }
            let tmpComparisonData = {
              UndoDelta: libObjectDiff.detailedDiff(tmpCurrentStateData, tmpCurrentUndoObject),
              UndoGUIDDelta: {
                Added: [],
                Deleted: []
              },
              RedoDelta: libObjectDiff.detailedDiff(tmpCurrentStateData, tmpCurrentRedoObject),
              RedoGUIDDelta: {
                Added: [],
                Deleted: []
              }
            };

            // Perform GUID diff operations
            // Get all GUID values from the form
            let tmpCurrentGUIDElements = [];
            let tmpCurrentDataIndex = 0;
            if (tmpCurrentStateData.hasOwnProperty('__GUID')) {
              tmpCurrentGUIDElements = Object.keys(tmpCurrentStateData.__GUID).sort();
            }

            // Get the deltas for undo data
            let tmpUndoGUIDElements = [];
            if (tmpCurrentUndoObject.hasOwnProperty('__GUID')) {
              tmpUndoGUIDElements = Object.keys(tmpCurrentUndoObject.__GUID).sort();
            }
            let tmpUndoDataIndex = 0;
            let tmpUndoDataMaxIndex = tmpUndoGUIDElements.length - 1;
            for (tmpCurrentDataIndex = 0; tmpCurrentDataIndex < tmpCurrentGUIDElements.length; tmpCurrentDataIndex++) {
              while (tmpUndoDataIndex <= tmpUndoDataMaxIndex && tmpUndoGUIDElements[tmpUndoDataIndex] != tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                // Check to see if the string in the Undo keys is less than the string in the current form element.
                // If so, it was deleted
                if (tmpUndoGUIDElements[tmpUndoDataIndex] < tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                  tmpComparisonData.UndoGUIDDelta.Added.push(tmpUndoGUIDElements[tmpUndoDataIndex]);
                  tmpUndoDataIndex++;
                } else {
                  // It must be greater if it is inequal, so break out of the while
                  break;
                }
              }
              if (tmpUndoDataIndex <= tmpUndoDataMaxIndex && tmpUndoGUIDElements[tmpUndoDataIndex] == tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                // If the elements match, skip it because it exists on both sides.
                tmpUndoDataIndex++;
              } else {
                tmpComparisonData.UndoGUIDDelta.Deleted.push(tmpCurrentGUIDElements[tmpCurrentDataIndex]);
              }
            }
            // If there are any GUIDS left in the Undo GUID list, they are additions
            for (let i = tmpUndoDataIndex; i <= tmpUndoDataMaxIndex; i++) {
              tmpComparisonData.UndoGUIDDelta.Added.push(tmpUndoGUIDElements[i]);
            }

            // Get the deltas for Redo data
            let tmpRedoGUIDElements = [];
            if (tmpCurrentRedoObject.hasOwnProperty('__GUID')) {
              tmpRedoGUIDElements = Object.keys(tmpCurrentRedoObject.__GUID).sort();
            }
            let tmpRedoDataIndex = 0;
            let tmpRedoDataMaxIndex = tmpRedoGUIDElements.length - 1;
            for (tmpCurrentDataIndex = 0; tmpCurrentDataIndex < tmpCurrentGUIDElements.length; tmpCurrentDataIndex++) {
              while (tmpRedoDataIndex <= tmpRedoDataMaxIndex && tmpRedoGUIDElements[tmpRedoDataIndex] != tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                // Check to see if the string in the Redo keys is less than the string in the current form element.
                // If so, it was deleted
                if (tmpRedoGUIDElements[tmpRedoDataIndex] < tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                  tmpComparisonData.RedoGUIDDelta.Added.push(tmpRedoGUIDElements[tmpRedoDataIndex]);
                  tmpRedoDataIndex++;
                } else {
                  // It must be greater if it is inequal, so break out of the while
                  break;
                }
              }
              if (tmpRedoDataIndex <= tmpRedoDataMaxIndex && tmpRedoGUIDElements[tmpRedoDataIndex] == tmpCurrentGUIDElements[tmpCurrentDataIndex]) {
                // If the elements match, skip it because it exists on both sides.
                tmpRedoDataIndex++;
              } else {
                tmpComparisonData.RedoGUIDDelta.Deleted.push(tmpCurrentGUIDElements[tmpCurrentDataIndex]);
              }
            }
            // If there are any GUIDS left in the Redo GUID list, they are additions
            for (let i = tmpRedoDataIndex; i <= tmpRedoDataMaxIndex; i++) {
              tmpComparisonData.RedoGUIDDelta.Added.push(tmpRedoGUIDElements[i]);
            }
            tmpCallBack(tmpComparisonData);
          });
        }
        createArrayContainers(pRecordObject, fCallback, pArrayPropertyAddress) {
          // Much simplified recursion that generates array containers
          if (this._Settings.DebugLog) {
            this.log.debug("Informary Data->Form marshalling recursive entry...");
          }
        }
        get nonFormData() {
          return this._NonHTMLState;
        }
        marshalDataToForm(pRecordObject, fCallback, pParentPropertyAddress, pContainerPropertyAddress, pContainerIndex) {
          // Because this is recursive, we only want to call this on the outermost call of the stack.
          let tmpRecoveryState = false;
          if (this._Settings.DebugLog) {
            this.log.debug("Informary Data->Form marshalling recursive entry...");
          }
          // Guard against bad record objects being passed in
          if (typeof pRecordObject !== 'object') {
            this.log.error('Invalid record object passed in!');
            return fCallback('Invalid record object passed in!');
          }
          if (pRecordObject === null) {
            return fCallback();
          }
          if (pRecordObject === undefined) {
            return fCallback();
          }
          let tmpParentPropertyAddress = typeof pParentPropertyAddress !== 'undefined' ? pParentPropertyAddress : false;
          let tmpParentPropertyAddressString = typeof pParentPropertyAddress !== 'undefined' ? pParentPropertyAddress : 'JSON OBJECT ROOT';
          let tmpContainerPropertyAddress = typeof pContainerPropertyAddress !== 'undefined' ? pContainerPropertyAddress : false;
          let tmpContainerPropertyIndex = typeof pContainerIndex !== 'undefined' ? pContainerIndex : false;
          if (this._Settings.DebugLog) {
            this.log.debug("Informary Data->Form found parent address [".concat(tmpParentPropertyAddress, "] and is parsing properties"));
          }
          if (tmpParentPropertyAddressString == 'JSON OBJECT ROOT') {
            // Check if there is data to go into the NonHTMLState object
            if (pRecordObject.hasOwnProperty(this._NonHTMLStateProperty) && typeof pRecordObject[this._NonHTMLStateProperty] === 'object') {
              // Every time we marshal data to the form, we will overwrite this.
              // TODO: Should we warn or anything?  This is a potentially destructive operation.
              this._NonHTMLState = pRecordObject[this._NonHTMLStateProperty];
            }
          }
          let tmpRecordObjectKeys = Object.keys(pRecordObject);
          tmpRecordObjectKeys.forEach(pKey => {
            let tmpRecord = pRecordObject[pKey];
            let tmpPropertyAddress = tmpParentPropertyAddress.length > 0 ? "".concat(pParentPropertyAddress, ".").concat(pKey) : pKey;
            if (this._Settings.DebugLog) {
              this.log.debug("Informary Data->Form parent address [".concat(tmpParentPropertyAddressString, "] parsing property [").concat(tmpPropertyAddress, "]"));
            }
            switch (typeof tmpRecord) {
              // If it's an object, check if we should be marshaling the whole value in or recursing.
              case 'object':
                // Check to see if it's an array, as we will put it into the extended object.
                if (Array.isArray(tmpRecord)) {
                  for (let i = 0; i < tmpRecord.length; i++) {
                    // The undefined is in the Property Address because this is an array element, and needs to be put in the array.
                    this.marshalDataToForm(tmpRecord[i], () => {}, undefined, tmpPropertyAddress, i.toString());
                  }
                } else {
                  // We've switched this to synchronous for safe browser mode
                  // Leaving an empty callback in there in case we decide to switch back.
                  return this.marshalDataToForm(tmpRecord, () => {}, tmpPropertyAddress, tmpContainerPropertyAddress, tmpContainerPropertyIndex.toString());
                }
                break;
              // Ignore undefined properties
              case 'undefined':
                break;
              // Otherwise marshal it into the form
              default:
                let tmpFormElement = [];
                if (tmpContainerPropertyAddress && tmpContainerPropertyIndex) {
                  // This is an array element
                  tmpFormElement = this._Dependencies.jquery("\n\t\t\t\t\t\t\t\tinput[data-i-form=\"".concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"][data-i-container=\"").concat(tmpContainerPropertyAddress, "\"][data-i-index=\"").concat(tmpContainerPropertyIndex, "\"],\n\t\t\t\t\t\t\t\tselect[data-i-form=\"").concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"][data-i-container=\"").concat(tmpContainerPropertyAddress, "\"][data-i-index=\"").concat(tmpContainerPropertyIndex, "\"],\n\t\t\t\t\t\t\t\ttextarea[data-i-form=\"").concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"][data-i-container=\"").concat(tmpContainerPropertyAddress, "\"][data-i-index=\"").concat(tmpContainerPropertyIndex, "\"]\n\t\t\t\t\t\t\t"));
                } else {
                  tmpFormElement = this._Dependencies.jquery("\n\t\t\t\t\t\t\t\tinput[data-i-form=\"".concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"],\n\t\t\t\t\t\t\t\tselect[data-i-form=\"").concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"],\n\t\t\t\t\t\t\t\ttextarea[data-i-form=\"").concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"]\n\t\t\t\t\t\t\t"));
                }
                if (tmpFormElement.length > 0) {
                  // set the text area to the text content
                  if (this._Dependencies.jquery(tmpFormElement)[0].tagName === 'TEXTAREA') {
                    this._Dependencies.jquery(tmpFormElement)[0].textContent = tmpRecord;
                    // set the correct option to 'selected' for select tags
                  } else if (this._Dependencies.jquery(tmpFormElement)[0].tagName === 'SELECT') {
                    this._Dependencies.jquery("select[data-i-form=\"".concat(this._Settings.Form, "\"][data-i-datum=\"").concat(tmpPropertyAddress, "\"] option[value=\"").concat(tmpRecord, "\"]")).prop('selected', true);
                    // otherwise just set the value for input
                  } else {
                    this._Dependencies.jquery(tmpFormElement).val(tmpRecord);
                  }
                  // Check if this is a GUID value and set the data-i-guid property in it
                  var tmpGUIDAttribute = this._Dependencies.jquery(this).attr('data-i-guid');
                  // For some browsers, `attr` is undefined; for others,
                  // `attr` is false.  Check for both.
                  if (typeof tmpGUIDAttribute !== 'undefined' && tmpGUIDAttribute !== false) {
                    this._Dependencies.jquery(tmpFormElement).attr('data-i-guid', tmpRecord);
                  }
                }
                break;
            }
          });
          if (!pParentPropertyAddress) {
            return fCallback(tmpRecoveryState);
          } else {
            return fCallback();
          }
        }
        marshalFormToData(pRecordObject, fCallback) {
          if (this._Settings.DebugLog) {
            this.log.debug("Informary Form->Data marshalling recursive entry...");
          }
          // Guard against bad record objects being passed in
          if (typeof pRecordObject !== 'object') {
            this.log.error('Invalid record object passed in!  Informary needs a Javascript object to put values into.');
            return fCallback('Invalid record object passed in!  Informary needs a Javascript object to put values into.');
          }
          let tmpFormValueElements = this._Dependencies.jquery("\n\t\t\t\tinput[data-i-form=".concat(this._Settings.Form, "],\n\t\t\t\tselect[data-i-form=").concat(this._Settings.Form, "],\n\t\t\t\ttextarea[data-i-form=").concat(this._Settings.Form, "]\n\t\t\t"));
          let tmpUnknownValueIndex = 0;

          // For any state that the form doesn't want to store in html elements, but still be merged into the informary record object
          pRecordObject[this._NonHTMLStateProperty] = this._NonHTMLState;
          this._Dependencies.jquery.each(tmpFormValueElements, (pRecordIndex, pRecordAddress) => {
            let tmpFormValueAddress = this._Dependencies.jquery(pRecordAddress).attr('data-i-datum');
            let tmpFormContainerAddress = this._Dependencies.jquery(pRecordAddress).attr('data-i-container');
            let tmpFormContainerIndex = this._Dependencies.jquery(pRecordAddress).attr('data-i-index');
            let tmpFormContainerGUID = this._Dependencies.jquery(pRecordAddress).attr('data-i-guid');
            let tmpFormValue;
            // check to see which element type this is before trying to collect the value
            if (this._Dependencies.jquery(pRecordAddress).tagName === 'TEXTAREA') {
              tmpFormValue = this._Dependencies.jquery(pRecordAddress).textContent;
            } else {
              tmpFormValue = this._Dependencies.jquery(pRecordAddress).val();
            }
            // If the value is non existant, set it to null
            if (typeof tmpFormValue === 'undefined') {
              tmpFormValue = null;
            }
            if (typeof tmpFormValueAddress === 'undefined') {
              tmpFormValueAddress = '__ERROR.UnsetDatum.' + tmpUnknownValueIndex;
              tmpUnknownValueIndex++;
            }
            if (tmpFormContainerGUID) {
              let tmpGUIDValueAddress = '__GUID.' + tmpFormContainerGUID;
              this.setValueAtAddress(pRecordObject, tmpGUIDValueAddress, tmpFormContainerGUID);
            }
            if (tmpFormContainerAddress && tmpFormContainerIndex) {
              this.setValueAtAddressInContainer(pRecordObject, tmpFormContainerAddress, tmpFormContainerIndex, tmpFormValueAddress, tmpFormValue);
            } else {
              this.setValueAtAddress(pRecordObject, tmpFormValueAddress, tmpFormValue);
            }
          });
          return fCallback();
        }
      }
      ;
      module.exports = Informary;
    }, {
      "./Informary-Log.js": 12,
      "cachetrax": 1,
      "deep-object-diff": 8
    }]
  }, {}, [11])(11);
});
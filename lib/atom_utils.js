"use strict";

const _ = require("lodash");
const AtomRange = require("atom").Range;

module.exports = {
  rangeFromEditor: function (editor) {
    const selections = editor.selections;

    if (selections.length <= 0) {
      return [0, 0];
    }

    return _.map(selections, function (selection) {
      const range = selection.getBufferRange();
      const start = editor.buffer.characterIndexForPosition(range.start);
      const end = editor.buffer.characterIndexForPosition(range.end);
      return [start, end];
    });
  },

  offsetToBufferRange: function (buffer, start, end) {
    if (!buffer) {
      return null;
    }
    const offsetIndex = buffer.offsetIndex;
    if (!offsetIndex) {
      console.error("no offsetIndex!");
      return null;
    }
    const startRow = offsetIndex.totalTo(start, "characters").rows;
    const colStart = start - offsetIndex.totalTo(startRow, "rows").characters;

    // TODO: we could begin at start since we already know its offset
    const endRow = offsetIndex.totalTo(end, "characters").rows;
    const colEnd = end - offsetIndex.totalTo(endRow, "rows").characters;
    return new AtomRange([startRow, colStart], [endRow, colEnd]);
  },
  rangeToOffset: function (buffer, row, col) {
    const offsetIndex = buffer.offsetIndex;
    if (!offsetIndex) {
      console.error("no offsetIndex!");
      return -1;
    }
    return buffer.offsetIndex.totalTo(row, "rows").characters + col;
  }
};

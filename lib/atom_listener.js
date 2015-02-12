/*jslint nomen: true, todo: true */
"use strict";

var flux = require("flukes"),
  fs = require("fs"),
  _ = require('lodash'),
  path = require("path"),
  DMP = require("diff_match_patch"),
  editorAction = require('./common/editor_action'),
  CompositeDisposable = require('atom').CompositeDisposable,
  util = require('util');

var floop = require("./common/floop"),
  utils = require("./utils");

var AtomListener = function (bufs, users) {
  this.bufs = bufs;
  this.users = users;
  this.editorID_ =  0;
  this.atomEditors = {};
  this.atomBuffers = {};
  this.disposables = null;
  this.send_patch_for = {};
};

AtomListener.prototype.onDidChange = function (buffer, change) {
  console.log("changed");
  if (this.ignore_events) {
    return;
  }

  if (!buffer.flufferID) {
    console.warn(buffer.getPath(), " is in project but not shared (and it changed).");
  }
  this.send_patch_for[buffer.flufferID] = true;
};

AtomListener.prototype.onDidStopChanging = function (buffer) {
  var p,
    text,
    fluffer,
    patches,
    md5_before,
    patch_text;

  if (!floop.connected || !this.send_patch_for[buffer.flufferID]) {
    return;
  }

  var patchInfo, newTxt;

  fluffer = this.bufs.get(buffer.flufferID);

  if (!fluffer || !fluffer.populated) {
    return;
  }

  console.log("really changed");
  this.send_patch_for[fluffer.id] = false;
  fluffer.send_patch([buffer.getText()]);
};

AtomListener.prototype.onDidSave = function (buffer) {
  var self = this,
    fluffer = this.bufs[buffer.flufferID];

  if (self.ignore_events || !fluffer || !fluffer.populated) {
    return;
  }

  floop.send_saved({id: fluffer.id});
};

AtomListener.prototype.onDidChangeSelectionRange = function (editor) {
  var range, start, end,
    fluffer = this.bufs[editor.flufferID],
    selections = editor.selections;

  if (selections.length <= 0) {
    return;
  }

  if (!fluffer || !fluffer.populated) {
    return;
  }

  floop.send_highlight({
    'id': fluffer.id,
    'ping': false,
    'summon': false,
    'following': false,
    'ranges': _.map(selections, function (selection){
      var range = selection.getBufferRange(),
        start = editor.buffer.characterIndexForPosition(range.start),
        end = editor.buffer.characterIndexForPosition(range.end);
      return [start, end];
    })
  });
};

AtomListener.prototype.onDidChangeCursorPosition = function (editor) {
  return editor;
};

AtomListener.prototype.onDidChangePath = function (editorOrBuffer) {
  var isEditor = editorOrBuffer.buffer,
    oldFluffer = this.bufs[editorOrBuffer.flufferID],
    fluffer = this.bufs.findFluffer(editorOrBuffer),
    oldPath, flufferID;

  if (oldFluffer) {
    oldPath = oldFluffer.path;
  }

  editorOrBuffer.flufferID = fluffer ? fluffer.id : -1;
  if (isEditor) {
    return;
  }

  if (oldPath) {
    // TODO: send event
    return;
  }
  if (fluffer) {
    // TODO: check to see if its shared 

  }
};

AtomListener.prototype.bindTo_ = function (obj, events) {
  var that = this,
    disposables = new CompositeDisposable();

  _.each(events, function (eventName) {
    var d, f_name = 'on' + eventName;

    function action () {
      var args = _.toArray(arguments);
      args.unshift(obj);
      that[f_name].apply(that, args);
    }
    disposables.add(obj[f_name](action));
  });
  this.disposables.add(disposables);

  obj.onDidDestroy(function () {
    disposables.dispose();
    that.disposables.remove(disposables);
    delete obj.flufferID;
  });
};
AtomListener.prototype.stop = function () {
  this.disposables.dispose();
  this.disposables = null;
};

AtomListener.prototype.start = function () {
  var that = this, d;

  this.disposables = new CompositeDisposable();

  d = atom.workspace.observeTextEditors(function (editor) {
    var p, fluffer, buffer, id;

    that.bindTo_(editor, ["DidChangePath", "DidChangeSelectionRange", "DidChangeCursorPosition"]);
    
    // TODO: store reverse mapping
    // TODO: 
    fluffer = that.bufs.findFluffer(editor);

    if (!fluffer) {
      id = -1;
      editor.flufferID = id;
    } else {
      id = fluffer.id;
    }

    if (!(id in that.atomEditors)) {
      that.atomEditors[id] = [];
    }
    that.atomEditors[id].push(editor);

    buffer = editor.getBuffer();
    // editors to buffers is many to one
    if (_.has(buffer, "flufferID")) {
      return;
    }
    
    buffer.flufferID = id;

    // TODO: maybe check to see if one is there first?
    that.atomBuffers[id] = buffer;

    that.bindTo_(buffer, ["DidChangePath", "DidSave", "DidStopChanging", "DidChange"]);
    if (!fluffer) {
      return;
    }
    fluffer.on(function (eventName, data) {
      console.log("buffer changed", eventName, data);
      if (that.ignore_events || !fluffer.populated) {
        return;
      }
      // TODO: just use a dirty flag on the buffer
      that.ignore_events = true;
      buffer.setText(fluffer.buf);
      that.ignore_events = false;
    });
  });

  that.disposables.add(d);

  editorAction.onPATCH(function (bufferID, dmpPatchResult, newTextPointer) {
    var fluffer = that.bufs.get(bufferID),
      buffer = that.atomBuffers[bufferID];

    if (buffer) {
      return;
    }

    fs.writeFile(utils.to_abs_path(fl.base_path, fluffer.path), newTextPointer[0], function (err) {
      if (err) {
        console.error(err);
      }
    });
  });
};

module.exports = AtomListener;

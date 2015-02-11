/* @flow weak */
/*global _, React, StringView, diff_match_patch, ace */
"use strict";

var Buffer, Buffers,
  flux = require("flukes"),
  utils = require("../utils"),
  floop = require("./floop"),
  editorAction = require("./editor_action"),
  // messageAction = require("./message_action"),
  FlooDMP = require("../floodmp").FlooDMP,
  dmp = new FlooDMP(),
  fields = flux.FieldTypes;

/**
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 */
function guid(id, owner, workspace) {
  return owner + "/" + workspace + "/" + id;
}


/**
 * @param {Object} data
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 * @constructor
 */

Buffer = flux.createModel({
  modelName: "Buffer",
  fieldTypes: {
    buf: fields.string,
    highlights: fields.array,
    id: fields.number,
    md5: fields.number,
    open: fields.bool,
    path: fields.string,
    visible: fields.bool,
    encoding: fields.string,
    populated: fields.bool,
  },
  getDefaultFields: function () {
    return {
      buf: null,
      encoding: "utf8",
    };
  },
});

Buffer.prototype.setGetBufTimeout = function () {
  var id = this.id;
  this.strike_timeout = setTimeout(function () {
    console.log("strikeout triggered because before md5s were different");
    floop.send_get_buf(id);
  }, 1100);
};

Buffer.prototype.setSaveBufTimeout = function () {
  var id = this.id;
  clearTimeout(this.saveTimeout);
  this.saveTimeout = setTimeout(function () {
    floop.send_save_buf({id: id});
  }, 2500);
};

Buffer.prototype.patch = function (patch_obj) {
  var self = this,
    buf,
    clean_patch = true,
    newTextPointer,
    i,
    md5_before,
    md5_after,
    patches,
    r,
    result,
    text,
    following;

  if (!this.populated) {
    return;
  }

  try {
    patches = dmp.patch_fromText(patch_obj.patch);
  } catch (e) {
    throw new Error("Received Invalid bytes from workspace." + e.toString() + "Patch was: " + patch_obj.patch);
  }

  console.debug("applying", patch_obj.patch, "to", patch_obj.path);
  // this.sidebar.userlist.setClientPath(patch_obj.user_id, patch_obj.path, patch_obj.id);
  // self.showEditorIfFollowing(patch_obj.user_id);

  md5_before = utils.md5(this.buf);
  if (patch_obj.md5_before !== md5_before) {
    console.log("starting md5s don't match! ours:", md5_before, "patch's:", patch_obj.md5_before);
  }
  if (_.isEmpty(patches)) {
    console.log("Got an empty set of patches.");
    return;
  }
  try {
    result = dmp.patch_apply(patches, this.buf);
  } catch (e) {
    console.sError("Patch apply error on web.",
      {
        patch: patches,
        buf: this.buf,
        result: result,
        subject: "Patch Apply Failed ",
        error: e,
        message: { description: "Patch apply failed"},
      }
    );
    throw e; //Continue to throw since it's already broken anyway.
  }
  text = result[0];
  for (i = 0; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  if (clean_patch === false) {
    // XXX: don't reset this. ask the server to merge/rebase/whatever
    console.error("Couldn't apply patch. Getting buffer from server...", result);
    // messageAction.log("Couldn't apply patch to buffer " + this.path + " Re-fetching buffer from server...");
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return;
  }
  md5_after = utils.md5(text);

  if (patch_obj.md5_before === md5_before && patch_obj.md5_after !== md5_after) {
    // XXX: again, don't reset this. ask the server to merge/rebase/whatever
    console.log("md5's don't match! buffer is", md5_after, "but we expected", patch_obj.md5_after);
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return;
  }
  newTextPointer = [];
  editorAction.patch(this.id, result, newTextPointer);
  this.set({'buf': newTextPointer[0]}, {silent: true});

  if (this.buf === text) {
    clearTimeout(this.strike_timeout);
    if (patch_obj.md5_after !== md5_after) {
      this.setGetBufTimeout();
    }
  } else if (patch_obj.md5_before !== md5_before) {
    clearTimeout(this.strike_timeout);
    this.setGetBufTimeout();
  } else {
    console.log("replacing didn't match :( should be", text, "but was", this.buf);
    try {
      console.log(dmp.patch_toText(dmp.patch_make(this.buf, text)));
    } catch (e) {
      console.log("Error making patch of text --> this.buf:", e);
    }
    //this.set_buf(this.id, this.buf);
  }
};

Buffers = flux.createCollection({
  modelName: "Buffers",
  model: Buffer,
  paths_to_ids: {},
  getBufferByPath: function (p) {
    var id = this.paths_to_ids[p];
    if (!id) {
      return;
    }
    return this.get(id);
  }
});

module.exports = {
  Buffer: Buffer,
  Buffers: Buffers,
};

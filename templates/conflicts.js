/** @jsx React.DOM */

"use strict";

const _ = require("lodash");
const path = require("path");
const React = require('react-atom-fork');
const floop = require("../common/floop");
const fs = require("fs");
const $ = require('atom-space-pen-views').$;
const utils = require("../utils");

module.exports = React.createClass({
  treeize_: function (obj) {
    var node, tree;
    node = tree = {};
    _.each(obj, function (p) {
      node = tree;
      p.split(path.sep).forEach(function (p) {
        if (p in node) {
          node = node[p];
          return;
        }
        node[p] = {};
        node = node[p];
      });
    });
    return tree;
  },
  getInitialState: function () {
    return {
      enabled: true,
      clicked: "",
    };
  },
  componentDidMount: function () {
    var local = this.refs.local;
    $(local.getDOMNode()).focus();
  },
  onClick: function (id) {
    console.log(id);
  },
  render_: function (name, items) {
    return (
      <div className="">
        <h3>{name}</h3>
        <ol>
          {
            _.map(items, function(b, id) {
              var path = b.path;
              return (<li key={id} className="" onClick={this.onClick.bind(this, id, path)}>{path}</li>);
            }, this)
          }
        </ol>
      </div>
    );
  },
  remote_: function () {
    this.setState({enabled: false});
    _.each(this.props.different, function (b, id) {
      let encoding = b.encoding || "utf8";
      floop.send_set_buf({
        id: id,
        buf: b.txt.toString(encoding),
        md5: b.md5,
        encoding: b,
      });
    });
    // ST3 behavior 
    // self.send({'name': 'saved', 'id': existing_buf['id']})

    _.each(this.props.missing, function (b, id) {
      floop.send_delete_buf({id: id});
    });

    _.each(this.props.newFiles, function (b, rel) {
      fs.readFile(b.path, function (err, data) {
        if (err) {
          console.log(err);
          return;
        }
        var encoding = utils.is_binary(data, data.length) ? "base64" : "utf8";

        floop.send_create_buf({
          path: rel,
          buf: data.toString(encoding),
          encoding: encoding,
          md5: utils.md5(data),
        });
      });
    });
    this.props.onHandledConflicts();
  },
  local_: function () {
    const fetch = _.merge(this.props.missing, this.props.different);
    this.setState({enabled: false});
    _.each(fetch, function (b, id) {
      floop.send_get_buf(id);
    });
    this.props.onHandledConflicts();
  },
  cancel_: function () {
    this.setState({enabled: false});
    require("../floobits").leave_workspace();
  },
  render: function() {
    var missing = this.render_("missing", this.props.missing);
    var different = this.render_("different", this.props.different);
    var newFiles = this.render_("newFiles", this.props.newFiles);
    var ignored = _.map(this.props.ignored, function (p) {
      return <li key={p}>{p}</li>;
    });
    var tooBig = _.map(this.props.tooBig, function (size, p) {
      return <li key={p}>{p}: {size}</li>;
    });
    return (
      <div className="native-key-bindings" style={{overflow: "auto"}}>
        <h1>Your local files are different from the workspace.</h1>
        <button disabled={!this.state.enabled} onClick={this.remote_}>Overwrite Remote Files</button>
        <button ref="local" disabled={!this.state.enabled} onClick={this.local_}>Overwrite Local Files</button>
        <button disabled={!this.state.enabled} onClick={this.cancel_}>Cancel</button>

        {missing}
        {different}
        {newFiles}
        {!this.props.ignored.length ? "" : 
          <div className="">
            <h3>Ignored</h3>
            <ol>
              { ignored }
            </ol>
          </div>
        }
        {!tooBig.length ? "" : 
          <div className="">
            <h3>Too Big</h3>
            <ol>
              { tooBig }
            </ol>
          </div>
        }
      </div> 
    );
  }
});

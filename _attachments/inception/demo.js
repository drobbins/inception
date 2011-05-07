define(function(require, exports, module) {

  exports.launch = function(env) {

    var Editor = require("ace/editor").Editor;
    var Renderer = require("ace/virtual_renderer").VirtualRenderer;
    var theme = require("ace/theme/twilight");

    var Router = require("router").Router;
    var FileTree = require("filetree").FileTree;
    var CouchData = require("couchdata").CouchData;

    var $db = null,
        databases = [],
        databasesFetched = 0,
        designDocs = {},
        designDocName = null,
        designDocObj = null,
        openFile;

    var container = document.getElementById("editor");
    env.editor = new Editor(new Renderer(container, theme));

    window.onresize = function onResize() {
      env.editor.resize();
    }; window.onresize();

    var Buffer = function(_name, _content) {

      var _dirty = false;

      function name() {
        return _name;
      }

      function content(data) {
        if (data) {
          if (data !== _content) {
            _content = data;
            _dirty = true;
          }
        } else {
          return _content;
        }
      }

      function dirty() {
        return _dirty;
      }

      return {        name: name,
        dirty: dirty,
        content: content
      };
    };

    var Buffers = (function(Editor) {

      var _buffers = {},
      _length = 0,
      openBufferName = null;

      function openBuffer(name, content) {
        ensureUpdated();
        if (typeof _buffers[name] === "undefined") {
          _length += 1;
          _buffers[name] = new Buffer(name, content);
        }
        openBufferName = name;
        Editor.getSelection().selectAll();
        Editor.onTextInput(_buffers[name].content());
      }

      function length() {
        return length;
      }

      function dirtyBuffers() {
        // return _(_buffers).chain().filter(function(val, key) { return val.dirty(); })
        //   .map(function(val, key) { console.log(arguments);return {key:key, val:val}; })
        //   .value();
        return _buffers;
      }

      function ensureUpdated() {
        if (openBufferName) {
          _buffers[openBufferName].content(Editor.session.toString());
        }
      }

      return {
        ensureUpdated:ensureUpdated,
        length: length,
        openBuffer: openBuffer,
        dirtyBuffers: dirtyBuffers
      };

    })(env.editor);

    var width = $("#treepane").width();
    $("#hide").bind("mousedown", function() {
      var treepane = $("#treepane").toggleClass("minimised");
      $("#editor").css({left:treepane.is(".minimised") ? 32 : width});
    });

    function maximise() {
      var treepane = $("#treepane").removeClass("minimised");
      $("#editor").css({left:width});
    }


    FileTree.init('#files');

    FileTree.nodeSelected(function (node) {
      if (node.is(".design_doc") && !node.data("loaded")) {
        var db = node.data("db"),
            ddoc = node.data("ddoc");
        CouchData.fetchddoc(db, ddoc).then(function (data) {
          var html = $(CouchData.generateHTML(data, db, ddoc));
          FileTree.appendNode(node, html);
          html.show();
          node.attr("data-loaded", "true");
        });
      }
    });

    Router.get('!/:db/_design/:ddoc/_attachments/*file',
               function (db, ddoc, path) {
                 CouchData.readAttachment(db, "_design/" + ddoc, path).then(
                   function(data) {
                     Buffers.openBuffer(Router.url(), data);
                   });
               });

    Router.get('!/:db/_design/:ddoc/views/:view/:type',
               function (db, ddoc, view, type) {
                 CouchData.readView(db, "_design/" + ddoc, view, type).then(
                   function(data) {
                     Buffers.openBuffer(Router.url(), data);
                   });
               });

    Router.get('!/:db/_design/:ddoc/filters/:filter',
               function (db, ddoc, filter) {
                 CouchData.readFilter(db, "_design/" + ddoc, filter).then(
                   function(data) {
                     Buffers.openBuffer(Router.url(), data);
                   });
               });

    Router.get('!/:db/_design/:ddoc/updates/:update',
               function (db, ddoc, update) {
                 CouchData.readUpdate(db, "_design/" + ddoc, update).then(
                   function(data) {
                     Buffers.openBuffer(Router.url(), data);
                   });
               });

    CouchData.loadDatabases().then(function (databases) {
      var html = "<ul>";
      _.each(databases, function(db, dbname) {
        html += "<li class='db'><h3>" + dbname + "</h3><ul>";
        _.each(db, function(ddoc) {
          html += "<li><a class='ddoc' data-db='" + dbname + "' data-ddoc='"+ddoc.id+"'>" + ddoc.id + "</a></li>";
        });
        html += "</ul>";
      });
      html += "</ul>";
      $("#dblisting").append(html);
    });

    function loadddoc(database, ddoc) {
      couch.db(database).get(ddoc).then(function (data) {
        var x = CouchData.transformDDoc(data);
        html = "<div class='ddocheader'><h3>" + database + "</h3>" + ddoc + "</div>";
        html += CouchData.generateHTML(x, database, data._id);
        $("#dblisting").hide();
        $("#files").empty().append(html).show();
      });
    }

    function ensureNotMinimised() {
      if ($("#treepane").is(".minimised")) {
        maximise();
      }
    }

    function setobj(arr, obj, val) {
      var x = arr.shift();
      if (typeof obj[x] === "undefined") {
        obj[x] = {};
      }
      if (arr.length === 0) {
        obj[x] = val;
      } else {
        setobj(arr, obj[x], val);
      }
    }

    function generateDDoc(db, docname, ddoc, buffers) {
      var attachments = [];
      _.each(buffers, function(val, key) {
        var match = Router.match("!/:db/_design/:ddoc/*rest", key);
        if (match[1] === db && "_design/" + match[2] === docname) {
          var arr = match[3].split("/");
          if (arr[0] === "_attachments") {
            arr.shift();
            attachments.push({
              name:arr.join("/"),
              data: val.content()
            });
          } else {
            setobj(arr, ddoc, val.content());
          }
       }
      });
      return {
        ddoc: ddoc,
        attachments: attachments
      };
    }

    $("#expandcontrolpanel").bind('mousedown', function () {
      $("body").toggleClass("max_console");
    });

    $("#dblisting").live('mousedown', function(e) {
      var $el = $(e.target);
      if ($el.is("a.ddoc")) {
        loadddoc($el.data("db"), $el.data("ddoc"));
      }
    });

    $("#dblistbtn").bind('mousedown', function() {
      ensureNotMinimised();
      $("#dblisting").show();
      $("#files").hide();
    });

    $("#couchapplist").bind('change', function() {
      loadDb($(this).val());
    });

    function saveAttachments(attachments, orig, db, ddoc, rev, callback) {
      if (attachments.length === 0) {
        callback(rev);
        return;
      }
      var doc = attachments.shift();
      var url = "/" + db + "/" + ddoc + "/" + doc.name;
      console.log("=> " + url);
      $.ajax({
        contentType:orig[doc.name].content_type,
        type:"PUT",
        url: url + "?rev=" + rev,
        data: doc.data,
        dataType:"json",
        success: function(data) {
          saveAttachments(attachments, orig, db, ddoc, data.rev, callback);
        }
      });
    }

    $("#push").bind('mousedown', function() {
      Buffers.ensureUpdated();
      var hasConsole = $("body").hasClass("max_console");
      if (!hasConsole) {
        $("body").addClass("max_console");
      }
      var match = Router.matchesCurrent("!/:db/_design/:ddoc/*rest");
      if (!match) {
        console.log("Nothing to push");
        return;
      }
      var db = match[1], ddoc = "_design/" + match[2];
      console.log("Starting push " + ddoc + " to " + db);
      couch.db(db).get(ddoc).then(function (data) {
        var x = generateDDoc(db, ddoc, data, Buffers.dirtyBuffers());
        saveAttachments(x.attachments, x.ddoc._attachments, db, ddoc, data._rev, function(newRev) {
          //delete x.ddoc._attachments;
          x.ddoc._rev = newRev;
          console.log("=> " + ddoc);
          couch.db(db).put(ddoc, JSON.stringify(x.ddoc)).then(function() {
            couch.clearCache();
            console.log("Push complete!");
            if (!hasConsole) {
              setTimeout(function () {
                $("body").removeClass("max_console");
              }, 2000);
            }
          });
        });
      });
    });

    $("#editor").bind("webkitTransitionEnd transitionend", function() {
      env.editor.resize();
    });

    $("#launch").bind('mousedown', function() {
      var match = Router.matchesCurrent("!/:db/_design/:ddoc/*rest");
      window.open("/" + match[1] + "/_design/" + match[2] + "/index.html");
    });

    Router.init();

    // Intercept console.logs and display them in our own log as well
    (function() {

      var tmp = console.log || null,
          $log = $("#log");

      console.log = function(data) {
        if (tmp) {
          tmp(data);
        }
        $log.append("<div class='logmsg'>" + data.toString() + "</div>");
        $log.attr({scrollTop: $log.attr("scrollHeight") });
      };

    })();

  };

});
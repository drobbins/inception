var requirejs=require('requirejs');
requirejs.config({nodeRequire: require});

requirejs(['couchapp', 'path', 'fs'], function(couchapp, path, fs){
    //var ignore = JSON.parse(fs.readFileSync(path.join(__dirname, ".couchappignore")).toString()),
    //    loadFileOptions = {ignore: ignore};
    var ddoc = {
        _id: '_design/inception'
    };

    module.exports = ddoc;
    function loadAllAttachments(ddoc, dir){
        var listings = fs.readdirSync(dir);
        listings.forEach(function(listing){
            var file = path.join(dir, listing),
                stat = fs.statSync(file),
                prefix = "";
            if(stat.isFile()){return;}
            if(path.basename(file) === "_attachments"){
                prefix = path.dirname(file).slice(__dirname.length+1);
                couchapp.loadAttachments(ddoc, file, prefix);
            } else {
                loadAllAttachments(ddoc, file);
            }
        });
    }

    loadAllAttachments(ddoc, __dirname);
});

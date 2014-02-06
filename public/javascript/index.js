(function (octocard) {
    octocard({
        name: NAME,
        api: '/api'
    });

    var editor = ace.edit('editor');
    editor.renderer.setShowGutter(false);
    editor.getSession().setMode('ace/mode/html');
    var previewBtn = document.getElementById('preview');
    var octocardContainer = document.getElementById('octocard');
    previewBtn.onclick = function () {
        octocardContainer.innerHTML = '';
        var code = editor.getValue();
        function get(data) {
            var reg = new RegExp('data\\-' + data + '="([^"]+)"');
            var r = code.match(reg);
            if (r) {
                return r[1];
            }
        }

        var avaliableModules = {
            'base': 1,
            'details': 1,
            'stats': 1,
            'repos': 1,
            'eventsStatis': 1,
            'orgs': 1
        };
        var modules = get('modules').split(',');
        var robustModules = [];
        for (var i = 0, l = modules.length; i < l; i++) {
            if (avaliableModules[modules[i]]) {
                robustModules.push(modules[i]);
            }
        }
        octocard({
            name: get('name'),
            modules: robustModules.join(','),
            reposNum: get('reposNum'),
            orgsNum: get('orgsNum'),
            api: '/api'
        });
    };
})(octocard);

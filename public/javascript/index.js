(function (octocard) {
    // editor
    var editor = ace.edit('editor');
    editor.renderer.setShowGutter(false);
    editor.getSession().setMode('ace/mode/html');
    var previewBtn = document.getElementById('preview');
    var octocardContainer = document.getElementById('octocard');

    var configKeys = [
        'name', 'element', 'modules',
        'reposNum', 'reposIgnored', 'orgsNum',
        'api', 'noFooter', 'noIsolated'
    ];
    var defaultValue = {
        'api': '/api'
    };
    var avaliableModules = {
        'base': 1,
        'details': 1,
        'stats': 1,
        'repos': 1,
        'eventsStatis': 1,
        'orgs': 1
    };
    var valueUpdater = {
        'modules': function (oldValue) {
            var modules = oldValue.split(',');
            var robustModules = [];
            for (var i = 0, l = modules.length; i < l; i++) {
                if (avaliableModules[modules[i]]) {
                    robustModules.push(modules[i]);
                }
            }
            return robustModules.join(',');
        }
    };

    // read config value from codes by key
    function getValue(key, code) {
        var reg = new RegExp('data\\-' + key + '="([^"]+)"');
        var r = code.match(reg);
        if (r) {
            return r[1];
        }
    }

    // preview octocard
    function preview() {
        octocardContainer.innerHTML = '';

        var code = editor.getValue();
        var config = {};

        for (i = 0; i < configKeys.length; i++) {
            var key = configKeys[i];
            var value = getValue(key, code);
            var updater = valueUpdater[key];
            if (value) {
                config[key] = updater ? updater(value) : value;
            }
            else {
                config[key] = defaultValue[key];
            }
        }

        octocard(config);
    }

    previewBtn.onclick = preview;
    preview();
})(octocard);

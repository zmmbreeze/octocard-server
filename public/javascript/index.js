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
            api: '/api'
        });
    };

    window.onload = function () {
        var copy = document.getElementById('copy');
        var client = new ZeroClipboard(copy, {
            moviePath: 'http://cdnjs.cloudflare.com/ajax/libs/zeroclipboard/1.3.1/ZeroClipboard.swf'
        });
        client.on('load', function(client) {
            var sampleCode = document.getElementById('sampleCode');
            client.setText(sampleCode.innerText || sampleCode.textContent);
            copy.style.display = 'block';
            client.on('complete', function(client, args) {
                alert('Copied! Paste them into your html file.');
            });
        });
    };
})(octocard);

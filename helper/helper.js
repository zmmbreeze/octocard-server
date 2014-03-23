/*jshint laxbreak:true */

/**
 * helper
 */

var Q = require('q');
var github = require('octonode');

var helper = module.exports = {
    /**
     * concat array without create new array
     * but src array will become useless.
     * @param {Array} a target array.
     * @param {Array} b src array.
     */
    concatArray: function (a, b) {
        b.unshift(0);
        b.unshift(a.length);
        Array.prototype.splice.apply(a, b);
    },
    /**
     * Get all pages of github data.
     *
     * @param {string} token .
     * @param {string} url api url.
     * @param {number} pageSize .
     * @return {Object} promise .
     */
    getAllGithubData: function (token, url, pageSize) {
        var page = 1;
        var results = [];

        pageSize = pageSize || 100;
        function getAllData() {
            return Q.ninvoke(github.client(token), 'get', url, page, pageSize)
                .spread(function (status, data, header) {
                    helper.concatArray(results, data);

                    var link = header.link;
                    // if has next page
                    if (link && ~link.indexOf('rel="next"')) {
                        page++;
                        return getAllData();
                    } else {
                        return results;
                    }
                });
        }

        return getAllData();
    }
};

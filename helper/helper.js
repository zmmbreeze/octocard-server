/*jshint laxbreak:true */

/**
 * helper
 */

var Q = require('q');
var github = require('octonode');
var nconf = require('nconf');

// all data's time to live
var ttl = nconf.get('dataTTL');

var helper = module.exports = {
    /**
     * concat array without create new array.
     * @param {Array} a target array.
     * @param {Array} b src array.
     */
    concatArray: function (a, b) {
        b.unshift(0);
        b.unshift(a.length);
        Array.prototype.splice.apply(a, b);
        b.shift();
        b.shift();
    },
    /**
     * Get all pages of github data.
     *
     * @param {string} token .
     * @param {string} url api url.
     * @param {Object=} params .
     * @return {Object} promise .
     */
    getAllGithubData: function (token, url, params) {
        var page = 1;
        var results = [];
        params = params || {};
        params.page = page;
        params.per_page = params.per_page || 100;

        function getAllData() {
            params.page = page;
            return Q.ninvoke(github.client(token), 'get', url, params)
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
    },
    /**
     * if data is outof date.
     *
     * @param {Object} infoData .
     * @param {number} ttl .
     * @return {boolean} .
     */
    isOutofDate: function (infoData) {
        return !(infoData
                && infoData.saveTime
                && (Date.now() < (infoData.saveTime.getTime() + ttl)));
    }
};

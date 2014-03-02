/*jshint laxbreak:true */

/**
 * helper
 */

module.exports = {
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
    }
};

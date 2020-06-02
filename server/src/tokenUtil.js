const Window = require('window');

global['window'] = new Window();
global['location'] = window.location ;
global['navigator'] = window.navigator;


var scriptTemplate = `
var _getNstToken = function () {
    var boot;
    (function(e){
        var $ = [], z = [];
        e.ef = (function() {
            var e = 0
              , t = 0
              , n = 0;
            return function(o) {
                e % 2 != 0 && (2 > t ? z[t++] = o : 3 > n && ($[n++] = o)),
                e++
            }
        }
        )();
        e.gh = (function() {
            var e = 0
              , t = 0
              , n = 0;
            return function(o) {
                e > 0 && e % 2 == 0 && (2 > t ? z[t++] = o : 3 > n && ($[n++] = o)),
                e++
            }
        }
        )();
        e.getNstToken = (function(){
            var e = "";
            return $.length > 0 && (e = z.join("") + String.fromCharCode(46) + $.join("")),e;
        });

    })(boot || (boot = {}));
    ----replace----
    return boot.getNstToken();
}
`;


var B365SimpleEncrypt = (function() {
    function e() {}
    return e.encrypt = function(t) {
        var n, i = "", r = t.length, o = 0, s = 0;
        for (o = 0; r > o; o++) {
            for (n = t.substr(o, 1),
            s = 0; s < e.MAP_LEN; s++)
                if (n == e.charMap[s][0]) {
                    n = e.charMap[s][1];
                    break
                }
            i += n
        }
        return i
    }
    ,
    e.decrypt = function(t) {
        var n, i = "", r = t.length, o = 0, s = 0;
        for (o = 0; r > o; o++) {
            for (n = t.substr(o, 1),
            s = 0; s < e.MAP_LEN; s++) {
                if (":" == n && ":|~" == t.substr(o, 3)) {
                    n = "\n",
                    o += 2;
                    break
                }
                if (n == e.charMap[s][1]) {
                    n = e.charMap[s][0];
                    break
                }
            }
            i += n
        }
        return i
    }
    ,
    e.MAP_LEN = 64,
    e.charMap = [["A", "d"], ["B", "e"], ["C", "f"], ["D", "g"], ["E", "h"], ["F", "i"], ["G", "j"], ["H", "k"], ["I", "l"], ["J", "m"], ["K", "n"], ["L", "o"], ["M", "p"], ["N", "q"], ["O", "r"], ["P", "s"], ["Q", "t"], ["R", "u"], ["S", "v"], ["T", "w"], ["U", "x"], ["V", "y"], ["W", "z"], ["X", "a"], ["Y", "b"], ["Z", "c"], ["a", "Q"], ["b", "R"], ["c", "S"], ["d", "T"], ["e", "U"], ["f", "V"], ["g", "W"], ["h", "X"], ["i", "Y"], ["j", "Z"], ["k", "A"], ["l", "B"], ["m", "C"], ["n", "D"], ["o", "E"], ["p", "F"], ["q", "0"], ["r", "1"], ["s", "2"], ["t", "3"], ["u", "4"], ["v", "5"], ["w", "6"], ["x", "7"], ["y", "8"], ["z", "9"], ["0", "G"], ["1", "H"], ["2", "I"], ["3", "J"], ["4", "K"], ["5", "L"], ["6", "M"], ["7", "N"], ["8", "O"], ["9", "P"], ["\n", ":|~"], ["\r", ""]],
    e
}
)();


function getNstToken(src) {
    var flagsText = src.match(/\'(\d+\|){5,}(\d+)\'/ig);
    var position = src.indexOf(flagsText);
    position = src.lastIndexOf('(function(){', position);
    nextPosition = src.indexOf('(ns_nstlib', position);
    nextPosition = src.indexOf(')();', nextPosition);
    var code = src.slice(position, nextPosition + 4);
    var scripts = scriptTemplate.replace('----replace----', code);
    eval(scripts);
    return _getNstToken();
}


module.exports = {
    getNstToken,
    B365SimpleEncrypt
}
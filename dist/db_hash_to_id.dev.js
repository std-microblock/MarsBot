"use strict";

!function _callee() {
  var _require, readFileSync, readdirSync, rmSync, writeFileSync, renameSync, existsSync, name, decodeUrlSafeBase64, encodeUrlSafeBase64, ids, data, collection, preprocess, i, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, doc, txt, res;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _require = require("fs"), readFileSync = _require.readFileSync, readdirSync = _require.readdirSync, rmSync = _require.rmSync, writeFileSync = _require.writeFileSync, renameSync = _require.renameSync, existsSync = _require.existsSync;
          name = 'ocr';

          decodeUrlSafeBase64 = function decodeUrlSafeBase64(str) {
            return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          };

          encodeUrlSafeBase64 = function encodeUrlSafeBase64(str) {
            return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
          };

          ids = readdirSync('./ai/data/text_similarity').map(function (v) {
            return decodeUrlSafeBase64(/embedding_msgid_(.*?).pt/.exec(v)[1]);
          });
          data = JSON.parse(readFileSync('marsBot.db', 'utf8'));
          collection = data.collections.find(function (v) {
            return v.name === 'checkerCollection-' + name;
          });

          preprocess = function preprocess(text) {
            return text.replace(/#\S+/, '').split(/via|from/)[0].trim();
          }; // console.log(ids)


          i = 0;
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context.prev = 12;
          _iterator = collection.data[Symbol.iterator]();

        case 14:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context.next = 35;
            break;
          }

          doc = _step.value;

          if (!(!doc.hash || doc.hash === 'No Result')) {
            _context.next = 18;
            break;
          }

          return _context.abrupt("continue", 32);

        case 18:
          txt = preprocess(doc.hash).trim();
          i++;

          if (!(txt.length === 0)) {
            _context.next = 22;
            break;
          }

          return _context.abrupt("continue", 32);

        case 22:
          if (!ids.includes("".concat(name, "-").concat(doc.id))) {
            _context.next = 24;
            break;
          }

          return _context.abrupt("continue", 32);

        case 24:
          process.stdout.write("".concat(i, "/").concat(collection.data.length, " ").concat((i / collection.data.length * 100).toFixed(2), "%\r"));
          _context.t0 = regeneratorRuntime;
          _context.next = 28;
          return regeneratorRuntime.awrap(fetch("http://127.0.0.1:5100/text/save_text_embedding", {
            body: JSON.stringify({
              "text": txt,
              "id": "".concat(name, "-").concat(doc.id)
            }),
            headers: {
              "Content-Type": "application/json"
            },
            method: "POST"
          }));

        case 28:
          _context.t1 = _context.sent.text();
          _context.next = 31;
          return _context.t0.awrap.call(_context.t0, _context.t1);

        case 31:
          res = _context.sent;

        case 32:
          _iteratorNormalCompletion = true;
          _context.next = 14;
          break;

        case 35:
          _context.next = 41;
          break;

        case 37:
          _context.prev = 37;
          _context.t2 = _context["catch"](12);
          _didIteratorError = true;
          _iteratorError = _context.t2;

        case 41:
          _context.prev = 41;
          _context.prev = 42;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 44:
          _context.prev = 44;

          if (!_didIteratorError) {
            _context.next = 47;
            break;
          }

          throw _iteratorError;

        case 47:
          return _context.finish(44);

        case 48:
          return _context.finish(41);

        case 49:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[12, 37, 41, 49], [42,, 44, 48]]);
}();
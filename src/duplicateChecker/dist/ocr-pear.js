"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.getDuplicates = exports.generate = void 0;
var string_similarity_1 = require("string-similarity");
var magic_bytes_js_1 = require("magic-bytes.js");
var puppeteer_1 = require("puppeteer");
var puppeteer_intercept_and_modify_requests_1 = require("puppeteer-intercept-and-modify-requests");
var promise_pool_1 = require("../promise-pool");
var recognize = function (img) { throw Error("Not initialized"); };
var browser;
function initializeOCR(pages) {
    if (pages === void 0) { pages = 5; }
    return __awaiter(this, void 0, void 0, function () {
        var newPage, pagesRecognizeFunc, pending, pool;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!browser) return [3 /*break*/, 2];
                    browser.close();
                    return [4 /*yield*/, new Promise(function (rs) { return setTimeout(rs, 5000); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    browser = undefined;
                    return [4 /*yield*/, puppeteer_1["default"].launch({
                            headless: true
                        })];
                case 3:
                    browser = _a.sent();
                    newPage = function () { return __awaiter(_this, void 0, void 0, function () {
                        var page, client, interceptManager;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, browser.newPage()];
                                case 1:
                                    page = _a.sent();
                                    page.setViewport({
                                        width: 10,
                                        height: 80
                                    });
                                    return [4 /*yield*/, page.target().createCDPSession()];
                                case 2:
                                    client = _a.sent();
                                    interceptManager = new puppeteer_intercept_and_modify_requests_1.RequestInterceptionManager(client);
                                    return [4 /*yield*/, interceptManager.intercept({
                                            urlPattern: "https://pearocr.com/js/668.*.js",
                                            resourceType: 'Script',
                                            modifyResponse: function (_a) {
                                                var body = _a.body;
                                                setTimeout(function () {
                                                    interceptManager.disable();
                                                }, 100);
                                                return {
                                                    body: body === null || body === void 0 ? void 0 : body.replace(/\,(\S+)\.addImage\=/, ',window.antOcr=$1,$1.addImage=')
                                                };
                                            }
                                        })];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, page.goto('https://pearocr.com/#/')];
                                case 4:
                                    _a.sent();
                                    page.evaluate("\n            const _refreshItemText = antOcr.refreshItemText\n    \n        const recognize = (img)=>{\n            return Promise.race([new Promise((rs)=>{\n                antOcr.deleteAll();\n                antOcr.addImage(img);\n                \n                antOcr.refreshItemText = (e)=>{\n                    _refreshItemText(e);\n                    rs(antOcr.RecoDataList[0].text);\n                    // rs(antOcr.RecoDataList[0].detail.map(v=>v.text).join('\\n'));\n                }\n            }),new Promise((_,rj)=>setTimeout(rj,20000,'timeout'))])\n        }\n    \n        window.recognize=recognize;");
                                    return [2 /*return*/, function (img) {
                                            // @ts-ignore
                                            return page.evaluate(function (img) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, window.recognize(img)];
                                                    case 1: return [2 /*return*/, _a.sent()];
                                                }
                                            }); }); }, img);
                                        }];
                            }
                        });
                    }); };
                    return [4 /*yield*/, Promise.all(new Array(pages).fill(0).map(function (v) { return newPage(); }))];
                case 4:
                    pagesRecognizeFunc = _a.sent();
                    pending = new Array(pages).fill(null);
                    pool = promise_pool_1.promisePool([], pages, true);
                    recognize = function (img) {
                        return pool.addTask(function (i) { return __awaiter(_this, void 0, void 0, function () {
                            var page, res;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        page = pending.findIndex(function (v) { return !v; });
                                        if (page === -1)
                                            throw "No page available";
                                        console.log("Using page", page);
                                        pending[page] = true;
                                        return [4 /*yield*/, pagesRecognizeFunc[page](img)];
                                    case 1:
                                        res = _a.sent();
                                        pending[page] = null;
                                        return [2 /*return*/, res];
                                }
                            });
                        }); });
                    };
                    return [2 /*return*/];
            }
        });
    });
}
initializeOCR();
exports.generate = function (_a) {
    var message = _a.message, client = _a.client, getMedia = _a.getMedia;
    return __awaiter(void 0, void 0, void 0, function () {
        var mediaBuf, attempt, res, ocrResult, e_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (((_b = message.media) === null || _b === void 0 ? void 0 : _b.className) !== 'MessageMediaPhoto')
                        return [2 /*return*/];
                    return [4 /*yield*/, getMedia()];
                case 1:
                    mediaBuf = (_d.sent());
                    console.log("[ OCR ] Recognizing..");
                    attempt = 0;
                    _d.label = 2;
                case 2:
                    if (!(attempt < 2)) return [3 /*break*/, 8];
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 5, , 7]);
                    return [4 /*yield*/, recognize("data:" + ((_c = magic_bytes_js_1["default"](mediaBuf)[0].mime) === null || _c === void 0 ? void 0 : _c.replace('jpeg', 'jpg')) + ";base64," + (mediaBuf.toString('base64')))];
                case 4:
                    res = _d.sent();
                    ocrResult = (res === null || res === void 0 ? void 0 : res.trim()) || 'No Result';
                    console.log('[ OCR ] Result:', ocrResult);
                    if (ocrResult.length < 10)
                        return [2 /*return*/, 'No Result'];
                    return [2 /*return*/, ocrResult];
                case 5:
                    e_1 = _d.sent();
                    console.warn("[ OCR ] Error", e_1);
                    initializeOCR();
                    return [4 /*yield*/, new Promise(function (rs) { return setTimeout(rs, 5000); })];
                case 6:
                    _d.sent();
                    return [3 /*break*/, 7];
                case 7:
                    attempt++;
                    return [3 /*break*/, 2];
                case 8:
                    console.error("[ OCR ] Failed to recognize");
                    return [2 /*return*/, 'No Result'];
            }
        });
    });
};
exports.getDuplicates = function (id, hash, ctx) { return __awaiter(void 0, void 0, Promise, function () {
    var res;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch("http://127.0.0.1:5000/text/find_closest", {
                    body: JSON.stringify({
                        "text": hash
                    }),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    method: "POST"
                })];
            case 1: return [4 /*yield*/, (_a.sent()).json()];
            case 2:
                res = _a.sent();
                return [2 /*return*/, res.map(function (v) { return ({
                        msgId: v.id.split('-')[1],
                        confidence: v.score
                    }); }).filter(function (v) {
                        var beforeMsg = ctx.getBeforeResult(v.msgId);
                        if (!beforeMsg)
                            return false;
                        var d = string_similarity_1.compareTwoStrings(beforeMsg.hash, hash);
                        return d > 0.65;
                    })];
        }
    });
}); };
// export const checkDuplicate = async (s1: string, s2: string) => {
//     if ([s1, s2].some(v => v === 'No Result')) return {
//         isDuplicated: false,
//         confidence: 0
//     }
//     const d = compareTwoStrings(s1, s2);
//     if (d > 0.65) {
//         const res = await fetch(`${MARS_PY_API_BASE}/text_similarity`, {
//             method: "POST",
//             body: JSON.stringify({
//                 "text1": s1,
//                 "text2": s2
//             }),
//             headers: {
//                 "Content-Type": "application/json"
//             }
//         }).then(r => r.json());
//         if (res.similarity_score > 0.8) {
//             return {
//                 isDuplicated: true,
//                 confidence: (d - 0.65) / (1 - 0.65),
//                 message: `(<b>AI</b> ${Math.round(res.similarity_score * 1000) / 10}%) `
//             }
//         }
//     }
//     return {
//         isDuplicated: false,
//         confidence: (d - 0.8) / 0.2
//     }
// }

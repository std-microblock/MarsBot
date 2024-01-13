"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
{
    var ts_1 = Error.toString;
    Error.toString = function () {
        var s = ts_1.apply(this, []);
        console.log("AA", s);
        if (s.includes("Error: Not connected") && s.includes("at ConnectionTCPFull.send ")) {
            console.log("Patch exiting...");
            process.exit(-1);
        }
        return s;
    };
}
var telegram_1 = require("telegram");
var events_1 = require("telegram/events");
var fs_1 = require("fs");
var lokijs_1 = require("lokijs");
var promises_1 = require("fs/promises");
var big_integer_1 = require("big-integer");
var phash = require("./duplicateChecker/phash");
var text = require("./duplicateChecker/text");
var ocr = require("./duplicateChecker/ocr-pear");
var mediaId = require("./duplicateChecker/mediaId");
var tg_1 = require("./tg");
var profiler_1 = require("./profiler");
var promise_pool_1 = require("./promise-pool");
var telegraf_1 = require("telegraf");
var socks_proxy_agent_1 = require("socks-proxy-agent");
var CHANNEL_ID = 'xinjingdaily';
var CHANNEL_NUMBER_ID = 1434817225;
var CHANNEL_BOT_ID = -1001434817225;
var ADMIN_GROUP_ID = 1601858692;
var GROUP_BOT_ID = -1001601858692;
var BOT_USER_ID = '1637508162';
var BOT_NAME = '投稿机器人';
var map = {
    '1434817225': '心惊报',
    '1601858692': '心惊报审核群'
};
var getIdLink = function (id) { return "<a href=\"https://t.me/c/" + id.replace('::', '/') + "\">" + getIdName(id) + "</a>"; };
var getIdName = function (id) {
    return id.replace(/(^\d{10,})/g, function (m) { var _a; return (_a = map[m]) !== null && _a !== void 0 ? _a : m; });
};
var db = new lokijs_1["default"]('marsBot.db');
db.loadDatabase({}, console.error);
db.autosaveEnable();
db.autosave = true;
var checkers = {
    mediaId: mediaId,
    phash: phash,
    text: text,
    ocr: ocr
};
var Mutex = /** @class */ (function () {
    function Mutex() {
        this._locked = false;
        this._waiting = [];
    }
    Mutex.prototype.guard = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.lockGuard(fn)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Mutex.prototype.lock = function () {
        var _this = this;
        return new Promise(function (rs) {
            if (!_this._locked) {
                _this._locked = true;
                rs();
            }
            else {
                _this._waiting.push(rs);
            }
        });
    };
    Mutex.prototype.unlock = function () {
        if (this._waiting.length > 0) {
            var next = this._waiting.shift();
            next();
        }
        else {
            this._locked = false;
        }
    };
    Mutex.prototype.lockGuard = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.lock()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 5]);
                        return [4 /*yield*/, fn()];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        this.unlock();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return Mutex;
}());
var createTextStore = function (name, defaultv) {
    var content = defaultv;
    if (fs_1.existsSync(name))
        content = JSON.parse(fs_1.readFileSync(name, 'utf-8'));
    if (content instanceof Object) {
        for (var key in defaultv) {
            if (!(key in content)) {
                content[key] = defaultv[key];
            }
        }
    }
    var lock = new Mutex();
    return [
        content,
        function () {
            return lock.lockGuard(function () { return __awaiter(void 0, void 0, void 0, function () {
                var e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, promises_1.writeFile(name + ".tmp", JSON.stringify(content, null, 4))];
                        case 1:
                            _a.sent();
                            if (!fs_1.existsSync(name + ".bak")) return [3 /*break*/, 3];
                            return [4 /*yield*/, promises_1.rm(name + ".bak")];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            if (!fs_1.existsSync(name)) return [3 /*break*/, 7];
                            _a.label = 4;
                        case 4:
                            _a.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, promises_1.rename(name, name + ".bak")];
                        case 5:
                            _a.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            e_1 = _a.sent();
                            console.error(e_1);
                            return [3 /*break*/, 7];
                        case 7: return [4 /*yield*/, promises_1.rename(name + ".tmp", name)];
                        case 8:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        }
    ];
};
var _a = createTextStore('./liftUpInfo.json', {
    enable: false,
    lastId: 0,
    ETA: 0,
    state: '闲置',
    total: 0,
    lastProfile: '暂无'
}), liftUpInfo = _a[0], saveLiftupInfo = _a[1];
/**
 * [
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '👍'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '👎'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '🤔'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '🔥'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '🤮'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '💩'
  },
  {
    CONSTRUCTOR_ID: 455247544,
    SUBCLASS_OF_ID: 1570858401,
    className: 'ReactionEmoji',
    classType: 'constructor',
    emoticon: '😁'
  }
]
 */
var escapeHtml = function (str) { return str.replace(/[&<>'"]/g, function (tag) { return ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
})[tag]; }); };
var ENABLE_CLIENT2 = true;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    function processMessage(message, client) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var channelId, res, duplicateResults, msg, msgId, autoReject, dupMap, _i, duplicateResults_1, res_1, dupMsg, dupTipsMsg;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        channelId = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();
                        console.log("[MSG " + channelId + "]", message.text);
                        if (![CHANNEL_NUMBER_ID.toString(), '1840302036'].includes(channelId)) return [3 /*break*/, 2];
                        return [4 /*yield*/, checkMessage(message, client, false)];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        setMessageReaction(message.peerId, message.id, "processing", client);
                        return [4 /*yield*/, checkMessage(message, client)];
                    case 3:
                        res = (_b.sent());
                        duplicateResults = res.duplicateResults, msg = res.message, msgId = res.msgId;
                        if (!duplicateResults) {
                            setMessageReaction(message.peerId, message.id, "empty", client);
                            return [2 /*return*/];
                        }
                        autoReject = channelId === ADMIN_GROUP_ID.toString();
                        if (!(duplicateResults.some(function (r) { return r.before.id.startsWith(CHANNEL_NUMBER_ID.toString()) && r.before.id !== r["this"].id; }) && duplicateResults.length < 10)) return [3 /*break*/, 5];
                        dupMap = {};
                        for (_i = 0, duplicateResults_1 = duplicateResults; _i < duplicateResults_1.length; _i++) {
                            res_1 = duplicateResults_1[_i];
                            (_a = dupMap[res_1.before.id]) !== null && _a !== void 0 ? _a : ;
                            [];
                            dupMap[res_1.before.id].push(res_1);
                        }
                        dupMsg = "<u> <b>\u706B\u661F\u62A5\u901F\u8BAF\uFF01</b></u>\n <a href=\"https://t.me/c/" + msgId.replace("::", "/") + "\">\u539F\u6D88\u606F</a>\n\n" + Object.entries(dupMap)
                            .map(function (_a) {
                            var msgId = _a[0], dups = _a[1];
                            return " + " + getIdLink(msgId) + "\n" + dups.map(function (r) { var _a; return "    - <b>" + r.checker + "</b> " + ((_a = r.message) !== null && _a !== void 0 ? _a : '') + "\u68C0\u51FA <b>" + Math.ceil(r.confidence * 100) + "%</b>"; }).join('\n');
                        })
                            .join('\n') + " \n                    \n" + (autoReject ? '向该消息回应👍表情以拒稿' : '请手动撤稿/拒稿');
                        console.log(dupMsg);
                        states.discoveredDuplicateToday++;
                        states.discoveredDuplicateTotal++;
                        saveStates();
                        return [4 /*yield*/, client.sendMessage(ADMIN_GROUP_ID, {
                                message: dupMsg,
                                replyTo: channelId === ADMIN_GROUP_ID.toString() ? msg : undefined,
                                parseMode: 'html'
                            })];
                    case 4:
                        dupTipsMsg = _b.sent();
                        if (autoReject) {
                            duplicateResultStore[dupTipsMsg.id] = {
                                dupMap: dupMap, dupMsg: dupMsg, dupMsgSimple: "\u91CD\u590D\u7684\u7A3F\u4EF6 | \u706B\u661F\u673A\u5668\u4EBA\u68C0\u51FA\u91CD\u590D & " + Object.keys(dupMap).map(function (v) { return getIdLink(v); }).join(' & ') + " ",
                                originMsg: message.id
                            };
                            saveDuplicateResult();
                        }
                        setMessageReaction(message.peerId, message.id, "duplicated", client);
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    var client1, client2, bot, telegramBot, _a, states, saveStates, setIntervalDaily, createStateMessage, stateMessage, debouncer, updateStateMessage, reactionMap, setMessageReaction, getCollection, msgCollection, getMessageById, getMediaCachedPath, getMediaCached, checkMessage, getMessages, messageQueue, _b, duplicateResultStore, saveDuplicateResult, busy, callbackIdMap, pagenationData, generatePageDocument, checkLiftUp, checkQueue, sleep, keepAlive;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, tg_1.createTGClient('./SESSION1', JSON.parse(fs_1.existsSync('./account1.json') ? fs_1.readFileSync('./account1.json', 'utf-8') || '{}' : '{}'))];
            case 1:
                client1 = _c.sent();
                if (!ENABLE_CLIENT2) return [3 /*break*/, 3];
                return [4 /*yield*/, tg_1.createTGClient("./SESSION2", JSON.parse(fs_1.existsSync('./account2.json') ? fs_1.readFileSync('./account2.json', 'utf-8') || '{}' : '{}'))];
            case 2:
                client2 = _c.sent();
                _c.label = 3;
            case 3:
                console.log("Client1:", client1.connected);
                console.log("Client2:", ENABLE_CLIENT2 && client2.connected);
                bot = new telegraf_1.Telegraf(fs_1.readFileSync('./TOKEN', 'utf-8'), {
                    telegram: { agent: new socks_proxy_agent_1.SocksProxyAgent('socks://192.168.31.1:7890/') }
                });
                telegramBot = new Proxy(bot.telegram, {
                    get: function (target, p, receiver) {
                        // Check if the property is a function
                        if ((typeof p === 'string') && typeof target[p] === 'function') {
                            // Wrap the function with retry logic
                            return function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                return __awaiter(this, void 0, void 0, function () {
                                    var maxRetries, retries, result, error_1;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                maxRetries = 3;
                                                retries = 0;
                                                _a.label = 1;
                                            case 1:
                                                if (!(retries < maxRetries)) return [3 /*break*/, 6];
                                                _a.label = 2;
                                            case 2:
                                                _a.trys.push([2, 4, , 5]);
                                                return [4 /*yield*/, target[p].apply(target, args)];
                                            case 3:
                                                result = _a.sent();
                                                return [2 /*return*/, result];
                                            case 4:
                                                error_1 = _a.sent();
                                                // Handle the error and retry if necessary
                                                console.error("Error calling " + p + ":", error_1);
                                                retries++;
                                                return [3 /*break*/, 5];
                                            case 5: return [3 /*break*/, 1];
                                            case 6:
                                                // Maximum retries reached, handle the failure accordingly
                                                console.error("Failed to call " + p + " after " + maxRetries + " retries");
                                                // You can throw an error here or return a default value/error object
                                                throw new Error("Failed to call " + p);
                                        }
                                    });
                                });
                            };
                        }
                        // If the property is not a function, simply return it
                        return target[p];
                    }
                });
                // enumerate all groups joined
                return [4 /*yield*/, client1.invoke(new telegram_1.Api.messages.GetDialogs({
                        limit: 100,
                        offsetPeer: new telegram_1.Api.InputPeerEmpty()
                    }))];
            case 4:
                // enumerate all groups joined
                _c.sent();
                if (!ENABLE_CLIENT2) return [3 /*break*/, 6];
                return [4 /*yield*/, client2.invoke(new telegram_1.Api.messages.GetDialogs({
                        limit: 100,
                        offsetPeer: new telegram_1.Api.InputPeerEmpty()
                    }))
                    // list all usable reactions in admin group
                    // const fullChat = await client1.invoke(new Api.channels.GetFullChannel({
                    //     channel: ADMIN_GROUP_ID
                    // }));
                    // console.log(fullChat.fullChat.availableReactions.reactions);
                    // return;
                ];
            case 5:
                _c.sent();
                _c.label = 6;
            case 6:
                _a = createTextStore('states.json', {
                    stateMessage: null,
                    discoveredDuplicateToday: 0,
                    discoveredDuplicateTotal: 0,
                    confirmedDuplicateToday: 0,
                    confirmedDuplicateTotal: 0
                }), states = _a[0], saveStates = _a[1];
                setIntervalDaily = function (callback) {
                    var now = new Date();
                    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    var diff = next.getTime() - now.getTime();
                    setTimeout(function () {
                        callback();
                        setIntervalDaily(callback);
                    }, diff);
                };
                setIntervalDaily(function () {
                    states.discoveredDuplicateToday = 0;
                    states.confirmedDuplicateToday = 0;
                    saveStates();
                });
                createStateMessage = function (force) {
                    if (force === void 0) { force = false; }
                    return __awaiter(void 0, void 0, void 0, function () {
                        var msg;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!states.stateMessage) return [3 /*break*/, 3];
                                    if (!force) return [3 /*break*/, 1];
                                    return [2 /*return*/, states.stateMessage];
                                case 1: return [4 /*yield*/, bot.telegram.deleteMessage(GROUP_BOT_ID, states.stateMessage)["catch"](console.warn)];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: return [4 /*yield*/, telegramBot.sendMessage(GROUP_BOT_ID, '查重 Bot 正在运行', {
                                        disable_notification: true
                                    })
                                    // pin the msg
                                    // await telegramBot.pinChatMessage(GROUP_BOT_ID, msg.message_id, {
                                    //     disable_notification: true
                                    // })
                                ];
                                case 4:
                                    msg = _a.sent();
                                    // pin the msg
                                    // await telegramBot.pinChatMessage(GROUP_BOT_ID, msg.message_id, {
                                    //     disable_notification: true
                                    // })
                                    states.stateMessage = msg.message_id;
                                    return [4 /*yield*/, saveStates()];
                                case 5:
                                    _a.sent();
                                    return [2 /*return*/, msg.message_id];
                            }
                        });
                    });
                };
                return [4 /*yield*/, createStateMessage()];
            case 7:
                stateMessage = _c.sent();
                debouncer = 0;
                updateStateMessage = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var currentId, SPLITER;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                currentId = debouncer + 1;
                                debouncer = currentId;
                                return [4 /*yield*/, new Promise(function (rs) { return setTimeout(rs, 3000); })];
                            case 1:
                                _a.sent();
                                if (debouncer !== currentId)
                                    return [2 /*return*/];
                                SPLITER = '-------' /*Reaction 示意：
                                🤔 正在处理 👍处理完毕 (空) 处理完毕:没有火星 🔥处理完毕:火星了*/;
                                return [4 /*yield*/, telegramBot.editMessageText(GROUP_BOT_ID, stateMessage, undefined, "\u706B\u661F\u6CE2\u7279 \u205C \u6B63\u5728\u8FD0\u884C\n        [\u4E0A\u6B21\u66F4\u65B0\uFF1A" + new Date().toLocaleString() + "]\n        \n        " + (liftUpInfo.enable ? SPLITER + "\n\u5411\u524D\u5B58\u50A8\n\u5F53\u524D\u8FDB\u5EA6\uFF1A" + liftUpInfo.lastId + "\n\u9884\u8BA1\u5269\u4F59\u65F6\u95F4\uFF1A" + (liftUpInfo.ETA / 60).toFixed(1) + " \u5C0F\u65F6\n\u5269\u4F59\u6D88\u606F\uFF1A" + liftUpInfo.total + "\n\u5F53\u524D\u72B6\u6001\uFF1A" + liftUpInfo.state + "\n\n\u4E0A\u6B21 Profile: \n" + liftUpInfo.lastProfile + "\n" + SPLITER : '') + "\n\n        \u5DF2\u68C0\u51FA\uFF1A<b>" + states.discoveredDuplicateTotal + "</b> \u6761\n        \u5DF2\u786E\u8BA4\uFF1A<b>" + states.confirmedDuplicateTotal + "</b> \u6761\n        \u4ECA\u65E5\u68C0\u51FA\uFF1A<b>" + states.discoveredDuplicateToday + "</b> \u6761\n        \u4ECA\u65E5\u786E\u8BA4\uFF1A<b>" + states.confirmedDuplicateToday + "</b> \u6761\n        ", {
                                        parse_mode: 'HTML'
                                    })];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                updateStateMessage();
                setInterval(updateStateMessage, 30 * 1000);
                reactionMap = {
                    processing: "🤔",
                    duplicated: "🔥",
                    ok: "😁",
                    processed: "👍",
                    enqueued: "👎"
                };
                setMessageReaction = function (peer, messageId, reaction, client) {
                    if (client === void 0) { client = client1; }
                    return false;
                    return client.invoke(new telegram_1.Api.messages.SendReaction({
                        peer: peer,
                        msgId: messageId,
                        reaction: reaction === 'empty' ? undefined : [new telegram_1.Api.ReactionEmoji({ emoticon: reactionMap[reaction] })]
                    }));
                };
                setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, createStateMessage()];
                            case 1:
                                stateMessage = _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }, 1000 * 60 * 60 * 2);
                getCollection = function (name) { var _a; return (_a = db.getCollection(name)) !== null && _a !== void 0 ? _a : db.addCollection(name, { unique: ['id'] }); };
                msgCollection = getCollection('messages');
                getMessageById = function (id, tg) {
                    if (tg === void 0) { tg = client1; }
                    return __awaiter(void 0, void 0, void 0, function () {
                        var cachedMsg, msgs;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, tg.getMessages(id.split("::")[0], { limit: 1, ids: [parseInt(id.split("::")[1])] })];
                                case 1: return [2 /*return*/, (_a.sent())[0]];
                                case 2: return [4 /*yield*/, tg.getMessages(new telegram_1.Api.PeerChannel({ channelId: big_integer_1["default"](id.split("::")[0]) }), { limit: 1, ids: [parseInt(id.split("::")[1])] })];
                                case 3:
                                    msgs = _a.sent();
                                    msgCollection.insert(__assign(__assign({}, msgs[0]), { id: id }));
                                    return [2 /*return*/, msgs[0]];
                            }
                        });
                    });
                };
                getMediaCachedPath = function (msg, tg) {
                    if (tg === void 0) { tg = client1; }
                    return __awaiter(void 0, void 0, void 0, function () {
                        var mediaId, mediaPath, media;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    mediaId = checkers.mediaId.generate({
                                        message: msg, client: client1,
                                        getMedia: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                            return [2 /*return*/, undefined];
                                        }); }); },
                                        getMediaPath: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                            return [2 /*return*/, undefined];
                                        }); }); },
                                        msgId: ''
                                    });
                                    if (!mediaId)
                                        return [2 /*return*/, undefined];
                                    mediaPath = "./media/" + mediaId;
                                    if (!!fs_1.existsSync(mediaPath)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, tg.downloadMedia(msg, {})];
                                case 1:
                                    media = _a.sent();
                                    if (!media) return [3 /*break*/, 3];
                                    return [4 /*yield*/, promises_1.writeFile(mediaPath, media)];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: return [2 /*return*/, mediaPath];
                            }
                        });
                    });
                };
                getMediaCached = function (msg, tg) {
                    if (tg === void 0) { tg = client1; }
                    return __awaiter(void 0, void 0, void 0, function () {
                        var path;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, getMediaCachedPath(msg, tg)];
                                case 1:
                                    path = _a.sent();
                                    if (!path)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, promises_1.readFile(path)];
                                case 2: return [2 /*return*/, _a.sent()];
                            }
                        });
                    });
                };
                checkMessage = function (message, client, returnFalseChecks, _a) {
                    if (returnFalseChecks === void 0) { returnFalseChecks = false; }
                    var _b = _a === void 0 ? {} : _a, _c = _b.nocheck, nocheck = _c === void 0 ? false : _c, _d = _b.profile, profile = _d === void 0 ? profiler_1.profiler('check-message-dedup') : _d, _e = _b.channelOnly, channelOnly = _e === void 0 ? true : _e;
                    return __awaiter(void 0, void 0, void 0, function () {
                        var msgId, duplicateResults, _loop_1, _f, _g, _i, checker;
                        var _h, _j, _k;
                        return __generator(this, function (_l) {
                            switch (_l.label) {
                                case 0:
                                    if (!msgCollection.findOne({ id: { $eq: message.id } }))
                                        msgCollection.insert(message);
                                    if (!message.peerId)
                                        throw new Error("No PeerId in message");
                                    msgId = ((_h = message.peerId.channelId) !== null && _h !== void 0 ? _h : message.peerId.groupId) + "::" + message.id;
                                    if (!message.id)
                                        throw new Error("No id in message");
                                    if ((_k = (_j = message.buttons) === null || _j === void 0 ? void 0 : _j.flat().length) !== null && _k !== void 0 ? _k : -1 > 0) {
                                        console.log("Non-normal message(with buttons): ", msgId, "skipped");
                                        return [2 /*return*/, {
                                                duplicateResults: [],
                                                message: message,
                                                msgId: msgId
                                            }];
                                    }
                                    console.log("Current Message ID:", msgId);
                                    duplicateResults = [];
                                    profile.start('parse');
                                    _loop_1 = function (checker) {
                                        var collection, result, ctx, res, _loop_2, _i, _a, before, ctx, duplicates, _b, duplicates_1, _c, msgId_1, confidence, msg;
                                        return __generator(this, function (_d) {
                                            switch (_d.label) {
                                                case 0:
                                                    collection = getCollection('checkerCollection-' + checker);
                                                    result = collection.findOne({
                                                        'id': {
                                                            $eq: msgId
                                                        }
                                                    });
                                                    if (!(result === null)) return [3 /*break*/, 2];
                                                    console.log('checkerCollection-' + checker, msgId, collection.findOne({
                                                        'id': {
                                                            $eq: msgId
                                                        }
                                                    }));
                                                    console.log(" = Generating: ", checker, msgId);
                                                    profile.start('generate-' + checker);
                                                    ctx = {
                                                        message: message,
                                                        client: client,
                                                        getMedia: function () {
                                                            return __awaiter(this, void 0, void 0, function () {
                                                                var res;
                                                                return __generator(this, function (_a) {
                                                                    switch (_a.label) {
                                                                        case 0:
                                                                            profile.start('get-media');
                                                                            return [4 /*yield*/, getMediaCached(message, client)];
                                                                        case 1:
                                                                            res = _a.sent();
                                                                            profile.start('generate-' + checker);
                                                                            return [2 /*return*/, res];
                                                                    }
                                                                });
                                                            });
                                                        },
                                                        getMediaPath: function () {
                                                            return __awaiter(this, void 0, void 0, function () {
                                                                var res;
                                                                return __generator(this, function (_a) {
                                                                    switch (_a.label) {
                                                                        case 0:
                                                                            profile.start('get-media');
                                                                            return [4 /*yield*/, getMediaCachedPath(message, client)];
                                                                        case 1:
                                                                            res = _a.sent();
                                                                            profile.start('generate-' + checker);
                                                                            return [2 /*return*/, res];
                                                                    }
                                                                });
                                                            });
                                                        },
                                                        msgId: msgId
                                                    };
                                                    return [4 /*yield*/, checkers[checker].generate(ctx)];
                                                case 1:
                                                    res = _d.sent();
                                                    result = { id: msgId, hash: res !== null && res !== void 0 ? res : null };
                                                    collection.insertOne(result);
                                                    _d.label = 2;
                                                case 2:
                                                    if (!!nocheck) return [3 /*break*/, 9];
                                                    console.log(" = Checking: ", checker, msgId);
                                                    profile.start('check-' + checker);
                                                    if (!result.hash) return [3 /*break*/, 9];
                                                    if (!checkers[checker].checkDuplicate) return [3 /*break*/, 7];
                                                    _loop_2 = function (before) {
                                                        var ctx, checkRes;
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0:
                                                                    // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;
                                                                    if (!before.id.startsWith(CHANNEL_NUMBER_ID) && channelOnly)
                                                                        return [2 /*return*/, "continue"];
                                                                    ctx = {
                                                                        before: function () { return getMessageById(before.id, client); },
                                                                        "this": function () { return message; },
                                                                        beforeId: before.id,
                                                                        thisId: msgId,
                                                                        client: client,
                                                                        getMediaCached: getMediaCached,
                                                                        getMediaCachedPath: getMediaCachedPath
                                                                    };
                                                                    return [4 /*yield*/, checkers[checker].checkDuplicate(result.hash, before.hash, ctx)];
                                                                case 1:
                                                                    checkRes = _a.sent();
                                                                    if (checkRes.isDuplicated || returnFalseChecks) {
                                                                        duplicateResults.push(__assign(__assign({}, checkRes), { before: before, "this": result, checker: checker }));
                                                                    }
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    };
                                                    _i = 0, _a = collection.find({ id: { $ne: msgId }, hash: { $ne: null } });
                                                    _d.label = 3;
                                                case 3:
                                                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                                                    before = _a[_i];
                                                    return [5 /*yield**/, _loop_2(before)];
                                                case 4:
                                                    _d.sent();
                                                    _d.label = 5;
                                                case 5:
                                                    _i++;
                                                    return [3 /*break*/, 3];
                                                case 6: return [3 /*break*/, 9];
                                                case 7:
                                                    if (!checkers[checker].getDuplicates) return [3 /*break*/, 9];
                                                    ctx = {
                                                        getBeforeResult: function (msgId) {
                                                            var msg = collection.findOne({ id: { $eq: msgId } });
                                                            if (!msg)
                                                                return null;
                                                            return {
                                                                hash: msg.hash
                                                            };
                                                        }
                                                    };
                                                    return [4 /*yield*/, checkers[checker].getDuplicates(msgId, result.hash, ctx)];
                                                case 8:
                                                    duplicates = _d.sent();
                                                    for (_b = 0, duplicates_1 = duplicates; _b < duplicates_1.length; _b++) {
                                                        _c = duplicates_1[_b], msgId_1 = _c.msgId, confidence = _c.confidence;
                                                        msg = collection.findOne({ id: { $eq: msgId_1 } });
                                                        if (!msg)
                                                            continue;
                                                        duplicateResults.push({
                                                            isDuplicated: true,
                                                            confidence: confidence,
                                                            before: msg,
                                                            "this": result,
                                                            checker: checker
                                                        });
                                                    }
                                                    _d.label = 9;
                                                case 9: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _f = [];
                                    for (_g in checkers)
                                        _f.push(_g);
                                    _i = 0;
                                    _l.label = 1;
                                case 1:
                                    if (!(_i < _f.length)) return [3 /*break*/, 4];
                                    checker = _f[_i];
                                    return [5 /*yield**/, _loop_1(checker)];
                                case 2:
                                    _l.sent();
                                    _l.label = 3;
                                case 3:
                                    _i++;
                                    return [3 /*break*/, 1];
                                case 4:
                                    profile.end();
                                    return [2 /*return*/, {
                                            duplicateResults: duplicateResults,
                                            message: message,
                                            msgId: msgId
                                        }];
                            }
                        });
                    });
                };
                getMessages = function (id) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, client1.getMessages(id, { limit: 30 })];
                        case 1: return [2 /*return*/, ((_a.sent()).sort(function (a, b) { return a.date - b.date; }))];
                    }
                }); }); };
                messageQueue = [];
                _b = createTextStore('duplicateResult.json', {}), duplicateResultStore = _b[0], saveDuplicateResult = _b[1];
                busy = undefined;
                bot.command('clean', function (ctx) {
                });
                bot.command('help', function (ctx) { return ctx.reply("/help - \u6B64\u9875\u9762\n/search [p:\u9875\u6570] <\u6B63\u5219> - \u641C\u7D22\n/ping - pong\n/restart - \u91CD\u542F Bot\n/liftup [id:\u5F00\u59CBid] - \u5207\u6362\u5411\u4E0A\u722C\u53D6"); });
                callbackIdMap = {};
                pagenationData = {};
                generatePageDocument = function (results, searchId, page, keyword) {
                    if (typeof page === 'string')
                        page = parseInt(page);
                    var displayHash = function (hash) {
                        if (typeof hash === "string") {
                            return hash.length > 60 ?
                                escapeHtml(hash).replace(keyword, "<b>" + keyword + "</b>").replace(/\n/g, '').slice(Math.max(0, hash.indexOf(keyword) - 20), hash.indexOf(keyword) + 60) + '...' :
                                escapeHtml(hash).replace(keyword, "<b>" + keyword + "</b>").replace(/\n/g, ' ');
                        }
                        if (hash instanceof Array)
                            return hash.map(function (v) { return displayHash(v); }).join(',');
                        if (hash instanceof Object) {
                            if (hash.label && hash.confidence) {
                                return hash.label + "-" + (hash.confidence * 100).toFixed(1) + "%";
                            }
                        }
                        return "<No Display>";
                    };
                    var msg = "\u627E\u5230  (Page " + page + ")\n\n" + results.slice((page - 1) * 10, page * 10)
                        .map(function (r, i) { return page * 10 - 10 + i + 1 + ". (" + r.checker + ") " + (r.message || '') + getIdLink(r.id) + ":\t\n" + displayHash(r.hash); }).join('\n\n');
                    var maxPage = Math.ceil(results.length / 10);
                    var btns = [
                        [
                            { text: "\u5171 " + results.length + " \u6761\u7ED3\u679C", callback_data: 'no-react' },
                            { text: page + " / " + maxPage, callback_data: 'no-react' }
                        ],
                        []
                    ];
                    if (page != 1)
                        btns[1].push({ text: "|<", callback_data: "pagination:searchData-" + searchId + "-1" });
                    if (page > 4)
                        btns[1].push({ text: "<<", callback_data: "pagination:searchData-" + searchId + "-" + (page - 4) });
                    if (page > 1)
                        btns[1].push({ text: "<", callback_data: "pagination:searchData-" + searchId + "-" + (page - 1) });
                    btns[1].push({ text: '×', callback_data: "removeMsg" });
                    if (page < maxPage - 1)
                        btns[1].push({ text: ">", callback_data: "pagination:searchData-" + searchId + "-" + (page + 1) });
                    if (page < maxPage - 4)
                        btns[1].push({ text: ">>", callback_data: "pagination:searchData-" + searchId + "-" + (page + 4) });
                    if (page < maxPage)
                        btns[1].push({ text: ">|", callback_data: "pagination:searchData-" + searchId + "-" + maxPage });
                    return {
                        msg: msg, btns: btns
                    };
                };
                bot.command('search', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
                    var query, pageRegex, page, queryText, results, _loop_3, _a, _b, _i, checker, searchId, _c, msg, btns, msgSent;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                query = ctx.args.join(" ");
                                console.log('search', query);
                                pageRegex = /p:(\d+)/;
                                page = pageRegex.test(query) ? parseInt(query.match(pageRegex)[1]) : 1;
                                queryText = query.replace(pageRegex, '').trim();
                                results = [];
                                _loop_3 = function (checker) {
                                    var collection, addResult, targetLabels_1, res_2, res2, res;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                collection = getCollection('checkerCollection-' + checker);
                                                addResult = function (res) {
                                                    for (var _i = 0, res_3 = res; _i < res_3.length; _i++) {
                                                        var v = res_3[_i];
                                                        results.push(__assign(__assign({}, v), { checker: checker }));
                                                    }
                                                };
                                                if (!(checker === 'deepDanbooru')) return [3 /*break*/, 1];
                                                targetLabels_1 = queryText.split(',').map(function (v) { return v.trim(); });
                                                // 没有不包含的
                                                addResult(collection.where(function (v) { return !targetLabels_1.some(function (tLabel) { return !v.hash.some(function (_a) {
                                                    var label = _a.label;
                                                    return label === tLabel;
                                                }); }); }));
                                                return [3 /*break*/, 5];
                                            case 1:
                                                if (!(checker === 'text' || checker === 'ocr')) return [3 /*break*/, 4];
                                                return [4 /*yield*/, fetch("http://127.0.0.1:5000/text/find_closest", {
                                                        body: JSON.stringify({
                                                            "text": queryText
                                                        }),
                                                        headers: {
                                                            "Content-Type": "application/json"
                                                        },
                                                        method: "POST"
                                                    })];
                                            case 2: return [4 /*yield*/, (_a.sent()).json()];
                                            case 3:
                                                res_2 = _a.sent();
                                                addResult(res_2.map(function (v) {
                                                    var _a;
                                                    return ({
                                                        id: v.id.split('-')[1],
                                                        hash: (_a = collection.findOne({ id: { $eq: v.id.split('-')[1] } })) === null || _a === void 0 ? void 0 : _a.hash
                                                    });
                                                }).filter(function (v) { return v.hash; }));
                                                res2 = collection.find({
                                                    'hash': {
                                                        $regex: queryText
                                                    }
                                                }).filter(function (v) { return !res_2.some(function (r) { return r.id.endsWith(v.id); }); });
                                                addResult(res2);
                                                return [3 /*break*/, 5];
                                            case 4:
                                                res = collection.find({
                                                    'hash': {
                                                        $regex: queryText
                                                    }
                                                });
                                                addResult(res);
                                                _a.label = 5;
                                            case 5: return [2 /*return*/];
                                        }
                                    });
                                };
                                _a = [];
                                for (_b in checkers)
                                    _a.push(_b);
                                _i = 0;
                                _d.label = 1;
                            case 1:
                                if (!(_i < _a.length)) return [3 /*break*/, 4];
                                checker = _a[_i];
                                return [5 /*yield**/, _loop_3(checker)];
                            case 2:
                                _d.sent();
                                _d.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4:
                                searchId = Math.floor(Math.random() * 1000000);
                                _c = generatePageDocument(results, searchId, page), msg = _c.msg, btns = _c.btns;
                                return [4 /*yield*/, ctx.reply(msg, {
                                        reply_markup: {
                                            inline_keyboard: btns
                                        },
                                        parse_mode: 'HTML'
                                    })];
                            case 5:
                                msgSent = _d.sent();
                                pagenationData[searchId] = {
                                    results: results, removeHandle: setTimeout(function () {
                                        ctx.deleteMessage(msgSent.message_id)["catch"](function () { });
                                        delete pagenationData[searchId];
                                    }, 1000 * 60 * 3)
                                };
                                return [2 /*return*/];
                        }
                    });
                }); });
                bot.command('rm', function (ctx) {
                    if (ctx.message.reply_to_message)
                        ctx.deleteMessage(ctx.message.reply_to_message.message_id);
                    ctx.deleteMessage(ctx.message.message_id);
                });
                bot.action('removeMsg', function (ctx) { return ctx.deleteMessage(ctx.message)["catch"](function () { }); });
                bot.action(/pagination:searchData-(\S+)-(\S+)/, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _, searchId, page, data, _b, msg, btns;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = ctx.match, _ = _a[0], searchId = _a[1], page = _a[2];
                                data = pagenationData[searchId];
                                clearTimeout(data.removeHandle);
                                data.removeHandle = setTimeout(function () {
                                    ctx.deleteMessage()["catch"](function () { });
                                    delete pagenationData[searchId];
                                }, 1000 * 60 * 3);
                                _b = generatePageDocument(data.results, searchId, page), msg = _b.msg, btns = _b.btns;
                                return [4 /*yield*/, ctx.editMessageText(msg, {
                                        reply_markup: {
                                            inline_keyboard: btns
                                        },
                                        parse_mode: 'HTML'
                                    })];
                            case 1:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                bot.command('ping', function (ctx) {
                    ctx.reply('pong');
                });
                checkLiftUp = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var targetId, interval, lastUsedTime, _loop_4, state_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!ENABLE_CLIENT2) {
                                    liftUpInfo.state = '未启用账号二，无法向上爬取';
                                    return [2 /*return*/];
                                }
                                targetId = 130494;
                                interval = 30;
                                lastUsedTime = 0;
                                _loop_4 = function () {
                                    var profile, lastId, ETA, start, messages, msgs, end;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                profile = profiler_1.profiler('liftup');
                                                lastId = liftUpInfo.lastId;
                                                ETA = Math.round(((lastId !== null && lastId !== void 0 ? lastId : 10000000) - targetId) / 50 * (lastUsedTime / 1000 / 60));
                                                liftUpInfo.total = (lastId !== null && lastId !== void 0 ? lastId : 10000000) - targetId;
                                                liftUpInfo.ETA = ETA;
                                                if (!(lastId && (lastId < 30 || lastId < targetId))) return [3 /*break*/, 2];
                                                liftUpInfo.enable = false;
                                                return [4 /*yield*/, saveLiftupInfo()];
                                            case 1:
                                                _a.sent();
                                                updateStateMessage();
                                                console.log("[ LiftUp ] Finished!");
                                                return [2 /*return*/, "break"];
                                            case 2:
                                                if (lastId)
                                                    console.log("[ LiftUp ] Checking to", lastId, 'ETA: ', ETA + 'mins');
                                                liftUpInfo.state = '拉取信息';
                                                updateStateMessage();
                                                start = Date.now();
                                                profile.start('pull-messages');
                                                return [4 /*yield*/, client2.getMessages(CHANNEL_ID, { limit: 50, offsetId: lastId })];
                                            case 3:
                                                messages = ((_a.sent()).sort(function (a, b) { return a.date - b.date; }));
                                                msgs = messages.map(function (m) { return [m, client2]; }).sort(function (a, b) { return b[0].id - a[0].id; });
                                                liftUpInfo.state = '检查中';
                                                updateStateMessage();
                                                profile.start('check-message');
                                                return [4 /*yield*/, promise_pool_1.promisePool(msgs.map(function (v, i) {
                                                        var message = v[0], client = v[1];
                                                        console.log("generate: id:", message.id, "index:", i);
                                                        return function () { return __awaiter(void 0, void 0, void 0, function () {
                                                            var i_1, e_2;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0:
                                                                        console.log("before exec: id:", message.id, "index:", i, msgs[i][0].id);
                                                                        liftUpInfo.state = "\u68C0\u67E5\u4E2D (" + i + " / " + msgs.length + ")";
                                                                        liftUpInfo.lastId = parseInt(message.id.toString());
                                                                        return [4 /*yield*/, saveLiftupInfo()];
                                                                    case 1:
                                                                        _a.sent();
                                                                        i_1 = 0;
                                                                        _a.label = 2;
                                                                    case 2:
                                                                        if (!(i_1 < 3)) return [3 /*break*/, 8];
                                                                        _a.label = 3;
                                                                    case 3:
                                                                        _a.trys.push([3, 5, , 7]);
                                                                        return [4 /*yield*/, checkMessage(message, client, false, { nocheck: true, profile: profile })];
                                                                    case 4:
                                                                        _a.sent();
                                                                        return [3 /*break*/, 8];
                                                                    case 5:
                                                                        e_2 = _a.sent();
                                                                        console.error('Failed to process message: ', e_2, 'retried for ', i_1, 'times');
                                                                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                                                                    case 6:
                                                                        _a.sent();
                                                                        return [3 /*break*/, 7];
                                                                    case 7:
                                                                        i_1++;
                                                                        return [3 /*break*/, 2];
                                                                    case 8: return [2 /*return*/];
                                                                }
                                                            });
                                                        }); };
                                                    })).promise];
                                            case 4:
                                                _a.sent();
                                                liftUpInfo.state = '等待';
                                                updateStateMessage();
                                                profile.start('wait');
                                                return [4 /*yield*/, new Promise(function (rs) { return setTimeout(rs, interval * 1000); })];
                                            case 5:
                                                _a.sent();
                                                end = Date.now();
                                                lastUsedTime = end - start;
                                                liftUpInfo.lastProfile = profile.endPrint();
                                                return [4 /*yield*/, saveLiftupInfo()];
                                            case 6:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                };
                                _a.label = 1;
                            case 1:
                                if (!liftUpInfo.enable) return [3 /*break*/, 3];
                                return [5 /*yield**/, _loop_4()];
                            case 2:
                                state_1 = _a.sent();
                                if (state_1 === "break")
                                    return [3 /*break*/, 3];
                                return [3 /*break*/, 1];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                checkLiftUp();
                bot.command('liftup', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
                    var startFrom;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                startFrom = parseInt(ctx.args[0] || '-1');
                                if (!liftUpInfo.enable) return [3 /*break*/, 2];
                                liftUpInfo.enable = false;
                                return [4 /*yield*/, saveLiftupInfo()];
                            case 1:
                                _a.sent();
                                ctx.reply("已关闭向上爬取");
                                return [3 /*break*/, 7];
                            case 2:
                                if (!(startFrom > 0 && !Number.isNaN(startFrom))) return [3 /*break*/, 4];
                                liftUpInfo.lastId = startFrom;
                                return [4 /*yield*/, saveLiftupInfo()];
                            case 3:
                                _a.sent();
                                liftUpInfo.enable = true;
                                checkLiftUp();
                                ctx.reply("\u5DF2\u5F00\u542F\u5411\u4E0A\u722C\u53D6\uFF0C\u5C06\u4ECE t.me/" + CHANNEL_ID + "/" + startFrom + " \u5F00\u59CB\u7EE7\u7EED\u722C\u53D6");
                                return [3 /*break*/, 7];
                            case 4:
                                if (!(ctx.args[0] === 'latest')) return [3 /*break*/, 6];
                                liftUpInfo.enable = true;
                                checkLiftUp();
                                delete liftUpInfo.lastId;
                                return [4 /*yield*/, saveLiftupInfo()];
                            case 5:
                                _a.sent();
                                ctx.reply("\u5DF2\u5F00\u542F\u5411\u4E0A\u722C\u53D6\uFF0C\u5C06\u4ECE\u6700\u65B0\u6D88\u606F\u5F00\u59CB\u722C\u53D6");
                                return [3 /*break*/, 7];
                            case 6:
                                liftUpInfo.enable = true;
                                checkLiftUp();
                                ctx.reply("\u5DF2\u5F00\u542F\u5411\u4E0A\u722C\u53D6\uFF0C\u5C06\u6309\u4E0A\u6B21\u8FDB\u5EA6\u7EE7\u7EED\u722C\u53D6");
                                _a.label = 7;
                            case 7: return [2 /*return*/];
                        }
                    });
                }); });
                telegramBot.setMyCommands([
                    {
                        command: 'ping',
                        description: '检查在线状态'
                    },
                    {
                        command: 'search',
                        description: '搜索投稿记录'
                    },
                    {
                        command: 'help',
                        description: '查看帮助'
                    },
                    {
                        command: 'restart',
                        description: '重启 Bot'
                    },
                    {
                        command: 'liftup',
                        description: '开启/关闭向上爬取'
                    },
                    {
                        command: 'check',
                        description: '手动检查回复的消息'
                    },
                    {
                        command: 'relaunch',
                        description: '重启 API Bot'
                    }
                ]);
                !(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!1) return [3 /*break*/, 2];
                                return [4 /*yield*/, bot.launch().then(function () { return console.log("Telegraf Bot launched"); })];
                            case 1:
                                _a.sent();
                                return [3 /*break*/, 0];
                            case 2: return [2 /*return*/];
                        }
                    });
                }); })();
                checkQueue = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (!busy)
                            busy = new Promise(function (rs) { return __awaiter(void 0, void 0, void 0, function () {
                                var _a, message, client, i, e_3;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            if (!(messageQueue.length > 0)) return [3 /*break*/, 8];
                                            _a = messageQueue.shift(), message = _a[0], client = _a[1];
                                            i = 0;
                                            _b.label = 1;
                                        case 1:
                                            if (!(i < 3)) return [3 /*break*/, 7];
                                            _b.label = 2;
                                        case 2:
                                            _b.trys.push([2, 4, , 6]);
                                            return [4 /*yield*/, processMessage(message, client)];
                                        case 3:
                                            _b.sent();
                                            return [3 /*break*/, 7];
                                        case 4:
                                            e_3 = _b.sent();
                                            console.error('Failed to process message: ', e_3, 'retried for ', i, 'times');
                                            return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                                        case 5:
                                            _b.sent();
                                            return [3 /*break*/, 6];
                                        case 6:
                                            i++;
                                            return [3 /*break*/, 1];
                                        case 7: return [3 /*break*/, 0];
                                        case 8:
                                            busy = undefined;
                                            rs(void 0);
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                        return [2 /*return*/, busy];
                    });
                }); };
                client1.addEventHandler(function (_a) {
                    var message = _a.message;
                    return __awaiter(void 0, void 0, void 0, function () {
                        var channelId, textMessage, reply, messageId, msg, e_4, checkingTips, res, duplicateResults, msg2, msgId, e_5, _b, _, channelId_1, msgId, msg, msgId, msg;
                        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                        return __generator(this, function (_q) {
                            switch (_q.label) {
                                case 0:
                                    channelId = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();
                                    console.log("New Message from", channelId);
                                    if (!([
                                        ADMIN_GROUP_ID.toString(),
                                        CHANNEL_NUMBER_ID.toString(),
                                    ].includes(channelId)))
                                        return [2 /*return*/];
                                    textMessage = message.message;
                                    reply = function (msg) { return client1.sendMessage(message.peerId, {
                                        message: msg,
                                        replyTo: message.id
                                    })["catch"](console.error); };
                                    if (!(textMessage === null || textMessage === void 0 ? void 0 : textMessage.startsWith('/restart'))) return [3 /*break*/, 2];
                                    return [4 /*yield*/, client1.sendMessage(message.peerId, {
                                            message: '正在重启……',
                                            replyTo: message.id
                                        })["catch"](console.error)];
                                case 1:
                                    _q.sent();
                                    process.exit(0);
                                    _q.label = 2;
                                case 2:
                                    if (!(textMessage === null || textMessage === void 0 ? void 0 : textMessage.startsWith('/check'))) return [3 /*break*/, 11];
                                    messageId = textMessage.split(' ')[1] || (message.replyTo && (((_d = (_c = message.chat) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : message.fromId) + "::" + ((_e = message.replyTo) === null || _e === void 0 ? void 0 : _e.replyToMsgId))) || '';
                                    if (!messageId.includes('::'))
                                        reply('请回复消息或提供消息 ID (格式：peerId::msgId)');
                                    msg = void 0;
                                    _q.label = 3;
                                case 3:
                                    _q.trys.push([3, 5, , 6]);
                                    return [4 /*yield*/, getMessageById(messageId, client1)];
                                case 4:
                                    msg = _q.sent();
                                    return [3 /*break*/, 6];
                                case 5:
                                    e_4 = _q.sent();
                                    reply('获取原消息失败');
                                    return [2 /*return*/];
                                case 6:
                                    if (!msg) {
                                        reply('获取原消息失败');
                                        return [2 /*return*/];
                                    }
                                    return [4 /*yield*/, telegramBot.sendMessage(GROUP_BOT_ID, '正在检查……')];
                                case 7:
                                    checkingTips = _q.sent();
                                    _q.label = 8;
                                case 8:
                                    _q.trys.push([8, 10, , 11]);
                                    console.log(msg);
                                    return [4 /*yield*/, checkMessage(msg, client1, true, {
                                            nocheck: false,
                                            channelOnly: false
                                        })];
                                case 9:
                                    res = (_q.sent());
                                    duplicateResults = res.duplicateResults, msg2 = res.message, msgId = res.msgId;
                                    duplicateResults.sort(function (a, b) { return b.confidence - a.confidence; });
                                    console.log("Total:", duplicateResults.length);
                                    telegramBot.editMessageText(GROUP_BOT_ID, checkingTips.message_id, undefined, "\u68C0\u67E5\u7ED3\u679C\uFF1A\n\n" + duplicateResults.filter(function (v) { return v.confidence > 0; }).slice(0, 30).map(function (r) { return getIdLink(r.before.id) + " <b>" + r.checker + "</b> \u68C0\u51FA " + Math.ceil(r.confidence * 100) + "%"; }).join('\n'), {
                                        parse_mode: "HTML"
                                    });
                                    return [3 /*break*/, 11];
                                case 10:
                                    e_5 = _q.sent();
                                    try {
                                        telegramBot.editMessageText(GROUP_BOT_ID, checkingTips.message_id, undefined, "\u68C0\u67E5\u5931\u8D25\uFF1A" + e_5.toString());
                                    }
                                    catch (e2) {
                                        client1.sendMessage(ADMIN_GROUP_ID, {
                                            message: "\u68C0\u67E5\u5931\u8D25\uFF1A" + e_5.toString() + "\n\n" + e2.toString()
                                        });
                                    }
                                    return [3 /*break*/, 11];
                                case 11:
                                    if (textMessage === null || textMessage === void 0 ? void 0 : textMessage.startsWith('/relaunch')) {
                                        bot.launch();
                                        client1.sendMessage(message.peerId, {
                                            message: '已重新初始化 API Bot',
                                            replyTo: message.id
                                        });
                                    }
                                    if (!(textMessage === null || textMessage === void 0 ? void 0 : textMessage.startsWith('/dumpmsg'))) return [3 /*break*/, 13];
                                    _b = textMessage.split(' '), _ = _b[0], channelId_1 = _b[1], msgId = _b[2];
                                    return [4 /*yield*/, getMessageById(channelId_1 + "::" + msgId, client1)];
                                case 12:
                                    msg = _q.sent();
                                    if (!msg)
                                        return [2 /*return*/, reply('获取消息失败')];
                                    console.log(JSON.stringify(msg, null, 4));
                                    return [2 /*return*/, reply('已在控制台输出')];
                                case 13:
                                    console.log("New Message: ", message.text, 'sender', (_f = message.sender) === null || _f === void 0 ? void 0 : _f.id.toString());
                                    if (!(((_g = message.sender) === null || _g === void 0 ? void 0 : _g.id.toString()) === BOT_USER_ID && channelId === ADMIN_GROUP_ID.toString())) return [3 /*break*/, 17];
                                    if (!((_h = message.text) === null || _h === void 0 ? void 0 : _h.startsWith("发布人"))) return [3 /*break*/, 15];
                                    msgId = (_l = (_k = (_j = message.entities) === null || _j === void 0 ? void 0 : _j.find(function (v) { var _a; return ((_a = v) === null || _a === void 0 ? void 0 : _a.url.toString().includes("t.me/xinjingdaily/")); })) === null || _k === void 0 ? void 0 : _k.url) === null || _l === void 0 ? void 0 : _l.split("/").pop();
                                    if (!msgId) {
                                        console.log("从审核群获取消息直链失败");
                                        return [2 /*return*/];
                                    }
                                    return [4 /*yield*/, getMessageById(CHANNEL_NUMBER_ID + "::" + msgId, client1)];
                                case 14:
                                    msg = _q.sent();
                                    if (!msg)
                                        return [2 /*return*/, console.log("从审核群获取消息失败")];
                                    messageQueue.push([msg, client1]);
                                    return [3 /*break*/, 16];
                                case 15:
                                    if (((_m = message.text) === null || _m === void 0 ? void 0 : _m.startsWith("#待审核")) || (((_o = message.text) === null || _o === void 0 ? void 0 : _o.includes("状态:")) && ((_p = message.text) === null || _p === void 0 ? void 0 : _p.includes("模式:"))))
                                        return [2 /*return*/];
                                    messageQueue.push([message, client1]);
                                    _q.label = 16;
                                case 16:
                                    checkQueue();
                                    _q.label = 17;
                                case 17:
                                    // 对于频道：如果不是频道机器人发的，直接入队列
                                    if (channelId === CHANNEL_NUMBER_ID.toString() && message.postAuthor !== BOT_NAME) {
                                        messageQueue.push([message, client1]);
                                        checkQueue();
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    });
                }, new events_1.NewMessage({
                // chats: [
                //     CHANNEL_ID, "xinjingmars", "1601858692"
                // ]
                }));
                client1.addEventHandler(function (event) {
                    if (event.className === 'UpdateMessageReactions') {
                        if (event.reactions.results[0].reaction.emoticon === '👍') {
                            var duplicateInfo = duplicateResultStore[event.msgId];
                            if (duplicateInfo) {
                                client1.sendMessage(event.peer, {
                                    replyTo: duplicateInfo.originMsg,
                                    message: '/no ' + duplicateInfo.dupMsgSimple,
                                    parseMode: "html"
                                });
                                delete duplicateResultStore[event.msgId];
                                states.confirmedDuplicateToday++;
                                states.confirmedDuplicateTotal++;
                                saveStates();
                                saveDuplicateResult();
                            }
                        }
                    }
                });
                sleep = function (ms) { return new Promise(function (rs) { return setTimeout(rs, ms); }); };
                keepAlive = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var check;
                    return __generator(this, function (_a) {
                        check = function (client) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                !(function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                if (!1) return [3 /*break*/, 4];
                                                return [4 /*yield*/, sleep(100)];
                                            case 1:
                                                _a.sent();
                                                if (!!client.connected) return [3 /*break*/, 3];
                                                return [4 /*yield*/, Promise.race([
                                                        client.connect(),
                                                        sleep(1000)
                                                    ])];
                                            case 2:
                                                _a.sent();
                                                if (!client.connected)
                                                    process.exit(0);
                                                _a.label = 3;
                                            case 3: return [3 /*break*/, 0];
                                            case 4: return [2 /*return*/];
                                        }
                                    });
                                }); })();
                                !(function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                if (!1) return [3 /*break*/, 5];
                                                return [4 /*yield*/, sleep(30 * 1000)];
                                            case 1:
                                                _a.sent();
                                                return [4 /*yield*/, client.checkAuthorization()];
                                            case 2:
                                                if (!_a.sent()) return [3 /*break*/, 4];
                                                return [4 /*yield*/, client.getMe()];
                                            case 3:
                                                _a.sent();
                                                _a.label = 4;
                                            case 4: return [3 /*break*/, 0];
                                            case 5: return [2 /*return*/];
                                        }
                                    });
                                }); })();
                                return [2 /*return*/];
                            });
                        }); };
                        check(client1);
                        if (ENABLE_CLIENT2)
                            check(client2);
                        return [2 /*return*/];
                    });
                }); };
                keepAlive();
                return [2 /*return*/];
        }
    });
}); })();
/*
process.on('uncaughtException', (e) => {
    console.error(e)
})*/ 

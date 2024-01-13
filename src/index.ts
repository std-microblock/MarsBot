
{
    const ts = Error.toString
    Error.toString = function () {
        const s = ts.apply(this, []);
        console.log("AA", s)
        if (s.includes("Error: Not connected") && s.includes("at ConnectionTCPFull.send ")) {
            console.log("Patch exiting...")
            process.exit(-1)
        }
        return s
    }
}

import { Api, TelegramClient, tl } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events"

import { existsSync, readFileSync, writeFileSync } from "fs";
import Loki from 'lokijs'
import BigInteger, { max } from "big-integer";
import { spawn } from "child_process";
import { readFile, rename, rm, writeFile } from "fs/promises";
import puppeteer from "puppeteer";
import bigInt from "big-integer";
import { getInputChannel, resolveId } from "telegram/Utils";

import * as phash from "./duplicateChecker/phash";
import * as text from "./duplicateChecker/text";
import * as ocr from "./duplicateChecker/ocr-pear";
import * as mediaId from "./duplicateChecker/mediaId";
import * as deepDanbooru from "./duplicateChecker/deep-danbooru";
import { createTGClient } from "./tg";
import { Profiler, profiler } from "./profiler";
import { promisePool } from "./promise-pool";
import { Telegraf } from "telegraf";
import { SocksProxyAgent } from "socks-proxy-agent";
import { GetDuplicatesContext } from "./duplicateChecker/types";

const CHANNEL_ID = 'xinjingdaily';
const CHANNEL_NUMBER_ID = 1434817225;
const CHANNEL_BOT_ID = -1001434817225;
const ADMIN_GROUP_ID = 1601858692;
const GROUP_BOT_ID = -1001601858692;
const BOT_USER_ID = '1637508162'
const BOT_NAME = '投稿机器人'
const map = {
    '1434817225': '心惊报',
    '1601858692': '心惊报审核群',
};

const getIdLink = (id) => `<a href="https://t.me/c/${id.replace('::', '/')}">${getIdName(id)}</a>`;
const getIdName = (id) => {
    return id.replace(/(^\d{10,})/g, (m) => map[m] ?? m);
}


const db = new Loki('marsBot.db');


db.loadDatabase({}, console.error);
db.autosaveEnable();
db.autosave = true;

const checkers = {
    mediaId,
    phash,
    text,
    ocr,
    // deepDanbooru
}


interface DuplicateResult {
    isDuplicated: boolean,
    confidence: number,
    before: {
        id: string,
        hash: string
    },
    this: {
        id: string,
        hash: string
    },
    checker: string
}

class Mutex {
    constructor() {
    }

    private _locked = false;
    private _waiting: (() => void)[] = [];

    async guard(fn) {
        return await this.lockGuard(fn);
    }

    lock() {
        return new Promise<void>((rs) => {
            if (!this._locked) {
                this._locked = true;
                rs();
            } else {
                this._waiting.push(rs);
            }
        })
    }

    unlock() {
        if (this._waiting.length > 0) {
            const next = this._waiting.shift()!;
            next();
        } else {
            this._locked = false;
        }
    }

    async lockGuard(fn) {
        await this.lock();
        try {
            return await fn();
        } finally {
            this.unlock();
        }
    }
}

const createTextStore = (name: string, defaultv?: any) => {
    let content = defaultv;
    if (existsSync(name))
        content = JSON.parse(readFileSync(name, 'utf-8'));

    if (content instanceof Object) {
        for (const key in defaultv) {
            if (!(key in content)) {
                content[key] = defaultv[key];
            }
        }
    }

    let lock = new Mutex();
    return [
        content,
        () => {
            return lock.lockGuard(async () => {
                await writeFile(name + ".tmp", JSON.stringify(content, null, 4));
                if (existsSync(name + ".bak")) await rm(name + ".bak");
                if (existsSync(name)) {
                    try {
                        await rename(name, name + ".bak");
                    } catch (e) {
                        console.error(e)
                    }
                }
                await rename(name + ".tmp", name);
            })
        }
    ]
}

let [liftUpInfo, saveLiftupInfo] = createTextStore('./liftUpInfo.json', {
    enable: false,
    lastId: 0,
    ETA: 0,
    state: '闲置',
    total: 0,
    lastProfile: '暂无'
});

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

const escapeHtml = (str) => str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
})[tag]);

const ENABLE_CLIENT2 = true;

(async () => {
    const client1 = await createTGClient('./SESSION1', JSON.parse(
        existsSync('./account1.json') ? readFileSync('./account1.json', 'utf-8') || '{}' : '{}'
    ));
    let client2;
    if (ENABLE_CLIENT2) client2 = await createTGClient("./SESSION2", JSON.parse(
        existsSync('./account2.json') ? readFileSync('./account2.json', 'utf-8') || '{}' : '{}'
    ));
    console.log("Client1:", client1.connected);
    console.log("Client2:", ENABLE_CLIENT2 && client2.connected);

    const bot = new Telegraf(readFileSync('./TOKEN', 'utf-8'), {
        telegram: { agent: new SocksProxyAgent('socks://192.168.31.1:7890/') }
    })

    const telegramBot: typeof bot.telegram = new Proxy(bot.telegram, {
        get(target, p, receiver) {
            // Check if the property is a function
            if ((typeof p === 'string') && typeof target[p] === 'function') {
                // Wrap the function with retry logic
                return async function (...args) {
                    const maxRetries = 3; // Maximum number of retries
                    let retries = 0;
                    while (retries < maxRetries) {
                        try {
                            // Call the original function with the provided arguments
                            const result = await target[p].apply(target, args);
                            return result;
                        } catch (error) {
                            // Handle the error and retry if necessary
                            console.error(`Error calling ${p}:`, error);
                            retries++;
                        }
                    }
                    // Maximum retries reached, handle the failure accordingly
                    console.error(`Failed to call ${p} after ${maxRetries} retries`);
                    // You can throw an error here or return a default value/error object
                    throw new Error(`Failed to call ${p}`);
                }
            }
            // If the property is not a function, simply return it
            return target[p];
        },
    });


    // enumerate all groups joined
    await client1.invoke(new Api.messages.GetDialogs({
        limit: 100,
        offsetPeer: new Api.InputPeerEmpty()
    }))
    if (ENABLE_CLIENT2)
        await client2.invoke(new Api.messages.GetDialogs({
            limit: 100,
            offsetPeer: new Api.InputPeerEmpty()
        }))

    // list all usable reactions in admin group
    // const fullChat = await client1.invoke(new Api.channels.GetFullChannel({
    //     channel: ADMIN_GROUP_ID
    // }));
    // console.log(fullChat.fullChat.availableReactions.reactions);
    // return;

    const [states, saveStates] = createTextStore('states.json', {
        stateMessage: null,
        discoveredDuplicateToday: 0,
        discoveredDuplicateTotal: 0,
        confirmedDuplicateToday: 0,
        confirmedDuplicateTotal: 0,
    });

    const setIntervalDaily = (callback) => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = next.getTime() - now.getTime();
        setTimeout(() => {
            callback();
            setIntervalDaily(callback);
        }, diff);
    }

    setIntervalDaily(() => {
        states.discoveredDuplicateToday = 0;
        states.confirmedDuplicateToday = 0;
        saveStates();
    })

    const createStateMessage = async (force = false) => {
        if (states.stateMessage) {
            if (force) return states.stateMessage
            else await bot.telegram.deleteMessage(GROUP_BOT_ID, states.stateMessage).catch(console.warn)
        }

        const msg = await telegramBot.sendMessage(GROUP_BOT_ID, '查重 Bot 正在运行', {
            disable_notification: true
        })

        // pin the msg
        // await telegramBot.pinChatMessage(GROUP_BOT_ID, msg.message_id, {
        //     disable_notification: true
        // })
        states.stateMessage = msg.message_id;
        await saveStates();

        return msg.message_id;
    }

    let stateMessage = await createStateMessage();

    let debouncer = 0;
    const updateStateMessage = async () => {

        const currentId = debouncer + 1;
        debouncer = currentId
        await new Promise(rs => setTimeout(rs, 3000));
        if (debouncer !== currentId) return;

        const SPLITER = '-------'/*Reaction 示意：
        🤔 正在处理 👍处理完毕 (空) 处理完毕:没有火星 🔥处理完毕:火星了*/
        await telegramBot.editMessageText(GROUP_BOT_ID, stateMessage, undefined, `火星波特 ⁜ 正在运行
        [上次更新：${new Date().toLocaleString()}]
        
        ${liftUpInfo.enable ? `${SPLITER}\n向前存储\n当前进度：${liftUpInfo.lastId}\n预计剩余时间：${(liftUpInfo.ETA / 60).toFixed(1)} 小时\n剩余消息：${liftUpInfo.total}\n当前状态：${liftUpInfo.state}\n\n上次 Profile: \n${liftUpInfo.lastProfile}\n${SPLITER}` : ''}

        已检出：<b>${states.discoveredDuplicateTotal}</b> 条
        已确认：<b>${states.confirmedDuplicateTotal}</b> 条
        今日检出：<b>${states.discoveredDuplicateToday}</b> 条
        今日确认：<b>${states.confirmedDuplicateToday}</b> 条
        `, {
            parse_mode: 'HTML'
        })
    }

    updateStateMessage();
    setInterval(updateStateMessage, 30 * 1000)
    const reactionMap = {
        processing: "🤔",
        duplicated: "🔥",
        ok: "😁",
        processed: "👍",
        enqueued: "👎"
    } as const;

    const setMessageReaction = (peer, messageId, reaction: keyof typeof reactionMap | "empty", client = client1) => {
        return false
        return client.invoke(new Api.messages.SendReaction({
            peer,
            msgId: messageId,
            reaction: reaction === 'empty' ? undefined : [new Api.ReactionEmoji({ emoticon: reactionMap[reaction] })],
        }))
    }



    setInterval(async () => {
        stateMessage = await createStateMessage();
    }, 1000 * 60 * 60 * 2);

    const getCollection = (name) => db.getCollection(name) ?? db.addCollection(name, { unique: ['id'] });

    const msgCollection = getCollection('messages');

    const getMessageById: ((id: string, tg: TelegramClient) => any) = async (id, tg = client1) => {
        return (await tg.getMessages(id.split("::")[0], { limit: 1, ids: [parseInt(id.split("::")[1])] }))[0];
        const cachedMsg = msgCollection.findOne({ id: { $eq: id } });
        if (cachedMsg) return cachedMsg;
        else {
            const msgs = await tg.getMessages(new Api.PeerChannel({ channelId: bigInt(id.split("::")[0]) }), { limit: 1, ids: [parseInt(id.split("::")[1])] });
            msgCollection.insert({
                ...msgs[0],
                id: id,
            });
            return msgs[0];
        }
    }

    const getMediaCachedPath = async (msg: Api.Message, tg: TelegramClient = client1) => {
        const mediaId = checkers.mediaId.generate({
            message: msg, client: client1,
            getMedia: async () => undefined,
            getMediaPath: async () => undefined,
            msgId: ''
        });
        if (!mediaId) return undefined;
        // find in __dirname/media
        const mediaPath = `./media/${mediaId}`;
        if (!existsSync(mediaPath)) {
            const media = await tg.downloadMedia(msg, {});
            if (media)
                await writeFile(mediaPath, media);
        }
        return mediaPath;
    }

    const getMediaCached = async (msg: Api.Message, tg: TelegramClient = client1) => {
        const path = await getMediaCachedPath(msg, tg);
        if (!path) return;
        return await readFile(path);
    }

    const checkMessage = async (message: Api.Message, client: TelegramClient, returnFalseChecks = false, { nocheck = false, profile = profiler('check-message-dedup'), channelOnly = true } = {}) => {
        if (!msgCollection.findOne({ id: { $eq: message.id } }))
            msgCollection.insert(message);

        if (!message.peerId) throw new Error("No PeerId in message");
        // @ts-ignore
        const msgId = `${message.peerId.channelId ?? message.peerId.groupId}::${message.id}`;
        if (!message.id) throw new Error("No id in message");

        if (message.buttons?.flat().length ?? -1 > 0) {
            console.log("Non-normal message(with buttons): ", msgId, "skipped")
            return {
                duplicateResults: [],
                message,
                msgId
            }
        }

        console.log("Current Message ID:", msgId)

        const duplicateResults: DuplicateResult[] = [];

        profile.start('parse')

        for (const checker in checkers) {
            const collection = getCollection('checkerCollection-' + checker);

            let result = collection.findOne({
                'id': {
                    $eq: msgId
                }
            })

            if (result === null) {
                console.log('checkerCollection-' + checker, msgId, collection.findOne({
                    'id': {
                        $eq: msgId
                    }
                }))

                console.log(" = Generating: ", checker, msgId)
                profile.start('generate-' + checker)
                const ctx = {
                    message,
                    client,
                    async getMedia() {
                        profile.start('get-media');
                        const res = await getMediaCached(message, client);
                        profile.start('generate-' + checker);
                        return res
                    },
                    async getMediaPath() {
                        profile.start('get-media');
                        const res = await getMediaCachedPath(message, client);
                        profile.start('generate-' + checker);
                        return res;
                    },
                    msgId
                }
                const res = await checkers[checker].generate(ctx);

                result = { id: msgId, hash: res ?? null };
                collection.insertOne(result);
            }

            if (!nocheck) {
                console.log(" = Checking: ", checker, msgId)
                profile.start('check-' + checker)

                if (result.hash) {
                    if (checkers[checker].checkDuplicate)
                        for (const before of collection.find({ id: { $ne: msgId }, hash: { $ne: null } })) {
                            // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;
                            if (!before.id.startsWith(CHANNEL_NUMBER_ID) && channelOnly) continue;
                            const ctx = {
                                before() { return getMessageById(before.id, client) },
                                this() { return message },
                                beforeId: before.id,
                                thisId: msgId,
                                client,
                                getMediaCached,
                                getMediaCachedPath
                            }
                            const checkRes: {
                                isDuplicated: boolean,
                                confidence: number,
                                message?: string
                            } = await checkers[checker].checkDuplicate(result.hash, before.hash, ctx);

                            if (checkRes.isDuplicated || returnFalseChecks) {
                                duplicateResults.push({
                                    ...checkRes,
                                    before,
                                    this: result,
                                    checker
                                });
                            }
                        }
                    else if (checkers[checker].getDuplicates) {
                        const ctx: GetDuplicatesContext = {
                            getBeforeResult: (msgId) => {
                                const msg = collection.findOne({ id: { $eq: msgId } });
                                if (!msg) return null;
                                return {
                                    hash: msg.hash
                                }
                            }
                        };
                        const duplicates = await checkers[checker].getDuplicates(msgId, result.hash, ctx);
                        for (const { msgId, confidence } of duplicates) {
                            const msg = collection.findOne({ id: { $eq: msgId } });
                            if (!msg) continue;
                            duplicateResults.push({
                                isDuplicated: true,
                                confidence: confidence,
                                before: msg,
                                this: result,
                                checker
                            })
                        }
                    }
                }


            }
        }

        profile.end()

        return {
            duplicateResults,
            message,
            msgId
        }
    }

    const getMessages = async (id) => ((await client1.getMessages(id, { limit: 30, })).sort((a, b) => a.date - b.date));

    // writeFileSync('./1.json', JSON.stringify(await getMessages('xinjingmars'),null,4))
    const messageQueue: [Api.Message, TelegramClient][] = [];
    const [duplicateResultStore, saveDuplicateResult] = createTextStore('duplicateResult.json', {})

    let busy: Promise<undefined> | undefined = undefined;


    bot.command('clean', ctx => {

    })

    bot.command('help', ctx => ctx.reply(`/help - 此页面
/search [p:页数] <正则> - 搜索
/ping - pong
/restart - 重启 Bot
/liftup [id:开始id] - 切换向上爬取`))

    interface BotReplyDocument {
        msg: string,
        btns?: {
            text: string,
            callback: () => {}
        }[][],
        total?: number
    }
    const callbackIdMap = {};
    const pagenationData: {
        [id: string]: {
            generateResult: ((page: number) => BotReplyDocument),
            removeHandle: NodeJS.Timeout
        }
    } = {}

    const generatePageDocument = (results, searchId, page, keyword) => {
        if (typeof page === 'string') page = parseInt(page)
        const displayHash = (hash) => {
            if (typeof hash === "string") {
                return hash.length > 60 ?
                    escapeHtml(hash).replace(keyword, `<b>${keyword}</b>`).replace(/\n/g, '').slice(Math.max(0, hash.indexOf(keyword) - 20), hash.indexOf(keyword) + 60) + '...' :
                    escapeHtml(hash).replace(keyword, `<b>${keyword}</b>`).replace(/\n/g, ' ');
            }
            if (hash instanceof Array) return hash.map(v => displayHash(v)).join(',');
            if (hash instanceof Object) {
                if (hash.label && hash.confidence) {
                    return `${hash.label}-${(hash.confidence * 100).toFixed(1)}%`;
                }
            }

            return `<No Display>`
        }

        const msg = `找到  (Page ${page})\n\n` + results.slice((page - 1) * 10, page * 10)
            .map((r, i) => `${page * 10 - 10 + i + 1}. (${r.checker}) ${r.message || ''}${getIdLink(r.id)}:\t
${displayHash(r.hash)}`).join('\n\n')

        const maxPage = Math.ceil(results.length / 10);

        const btns =
            [
                [
                    { text: `共 ${results.length} 条结果`, callback_data: 'no-react' },
                    { text: `${page} / ${maxPage}`, callback_data: 'no-react' }
                ],
                []
            ];

        if (page != 1)
            btns[1].push({ text: "|<", callback_data: `pagination:searchData-${searchId}-1` })

        if (page > 4)
            btns[1].push({ text: "<<", callback_data: `pagination:searchData-${searchId}-${page - 4}` })

        if (page > 1)
            btns[1].push({ text: "<", callback_data: `pagination:searchData-${searchId}-${page - 1}` })

        btns[1].push({ text: '×', callback_data: `removeMsg` })

        if (page < maxPage - 1)
            btns[1].push({ text: ">", callback_data: `pagination:searchData-${searchId}-${page + 1}` })

        if (page < maxPage - 4)
            btns[1].push({ text: ">>", callback_data: `pagination:searchData-${searchId}-${page + 4}` })

        if (page < maxPage)
            btns[1].push({ text: ">|", callback_data: `pagination:searchData-${searchId}-${maxPage}` })

        return {
            msg, btns
        }
    }

    bot.command('search', async (ctx) => {
        const query = ctx.args.join(" ");
        console.log('search', query)
        const pageRegex = /p:(\d+)/;
        const page = pageRegex.test(query) ? parseInt(query.match(pageRegex)![1]) : 1;
        const queryText = query.replace(pageRegex, '').trim();

        const results: any[] = [];
        for (const checker in checkers) {
            const collection = getCollection('checkerCollection-' + checker);

            const addResult = (res) => {
                for (const v of res)
                    results.push({
                        ...v,
                        checker
                    });
            }
            if (checker === 'deepDanbooru') {
                const targetLabels: string[] = queryText.split(',').map(v => v.trim());
                // 没有不包含的
                addResult(collection.where(v => !targetLabels.some(tLabel => !v.hash.some(({ label }) => label === tLabel))));

            } else if (checker === 'text' || checker === 'ocr') {
                const res = await (await fetch("http://127.0.0.1:5000/text/find_closest", {
                    body: JSON.stringify(
                        {
                            "text": queryText
                        }
                    ),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    method: "POST"
                })).json()

                addResult(res.map(v => ({
                    id: v.id.split('-')[1],
                    hash: collection.findOne({ id: { $eq: v.id.split('-')[1] } })?.hash
                })).filter(v => v.hash))

                const res2 = collection.find({
                    'hash': {
                        $regex: queryText
                    }
                }).filter(v => !res.some(r => r.id.endsWith(v.id)));
                addResult(res2);
            } else {
                const res = collection.find({
                    'hash': {
                        $regex: queryText
                    }
                });
                addResult(res);
            }
        }

        const searchId = Math.floor(Math.random() * 1000000)

        const { msg, btns } = generatePageDocument(results, searchId, page);

        const msgSent = await ctx.reply(msg, {
            reply_markup: {
                inline_keyboard: btns
            },
            parse_mode: 'HTML'
        });

        pagenationData[searchId] = {
            results, removeHandle: setTimeout(() => {
                ctx.deleteMessage(msgSent.message_id).catch(() => { })
                delete pagenationData[searchId]
            }, 1000 * 60 * 3)
        }
    })

    bot.command('rm', (ctx) => {
        if (ctx.message.reply_to_message)
            ctx.deleteMessage(ctx.message.reply_to_message.message_id);
        ctx.deleteMessage(ctx.message.message_id)
    })

    bot.action('removeMsg', ctx => ctx.deleteMessage(ctx.message).catch(() => { }))

    bot.action(/pagination:searchData-(\S+)-(\S+)/, async ctx => {
        const [_, searchId, page] = ctx.match;
        const data = pagenationData[searchId];
        clearTimeout(data.removeHandle)
        data.removeHandle = setTimeout(() => {
            ctx.deleteMessage().catch(() => { })
            delete pagenationData[searchId]
        }, 1000 * 60 * 3)
        const { msg, btns } = generatePageDocument(data.results, searchId, page);
        await ctx.editMessageText(msg, {
            reply_markup: {
                inline_keyboard: btns
            },
            parse_mode: 'HTML'
        })
    })

    bot.command('ping', ctx => {
        ctx.reply('pong')
    })

    const checkLiftUp = async () => {
        if (!ENABLE_CLIENT2) {
            liftUpInfo.state = '未启用账号二，无法向上爬取';
            return;
        }
        const targetId = 130494
        const interval = 30
        let lastUsedTime = 0;
        while (liftUpInfo.enable) {
            const profile = profiler('liftup')
            const lastId = liftUpInfo.lastId;
            const ETA = Math.round(((lastId ?? 10000000) - targetId) / 50 * (lastUsedTime / 1000 / 60))
            liftUpInfo.total = (lastId ?? 10000000) - targetId;
            liftUpInfo.ETA = ETA;
            if (lastId && (lastId < 30 || lastId < targetId)) {
                liftUpInfo.enable = false;
                await saveLiftupInfo();
                updateStateMessage();
                console.log("[ LiftUp ] Finished!");
                break
            }
            if (lastId)
                console.log("[ LiftUp ] Checking to", lastId, 'ETA: ', ETA + 'mins');

            liftUpInfo.state = '拉取信息';
            updateStateMessage();
            const start = Date.now();
            profile.start('pull-messages')
            const messages = ((await client2.getMessages(CHANNEL_ID, { limit: 50, offsetId: lastId })).sort((a, b) => a.date - b.date))
            const msgs = messages.map(m => [m, client2] as [Api.Message, TelegramClient]).sort((a, b) => b[0].id - a[0].id);
            liftUpInfo.state = '检查中'
            updateStateMessage();
            profile.start('check-message')

            await promisePool(msgs.map((v, i) => {
                const [message, client] = v
                console.log("generate: id:", message.id, "index:", i)
                return async () => {
                    console.log("before exec: id:", message.id, "index:", i, msgs[i][0].id)
                    liftUpInfo.state = `检查中 (${i} / ${msgs.length})`
                    liftUpInfo.lastId = parseInt(message.id.toString());
                    await saveLiftupInfo();
                    for (let i = 0; i < 3; i++) {
                        try {
                            await checkMessage(message, client, false, { nocheck: true, profile });
                            break;
                        } catch (e) {
                            console.error('Failed to process message: ', e, 'retried for ', i, 'times');
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
            })).promise;
            liftUpInfo.state = '等待';
            updateStateMessage();
            profile.start('wait')
            await new Promise(rs => setTimeout(rs, interval * 1000));
            const end = Date.now();
            lastUsedTime = end - start;
            liftUpInfo.lastProfile = profile.endPrint()
            await saveLiftupInfo();
        }
    }

    checkLiftUp()

    bot.command('liftup', async ctx => {
        const startFrom = parseInt(ctx.args[0] || '-1')
        if (liftUpInfo.enable) {
            liftUpInfo.enable = false;
            await saveLiftupInfo();
            ctx.reply("已关闭向上爬取")
        } else if (startFrom > 0 && !Number.isNaN(startFrom)) {
            liftUpInfo.lastId = startFrom
            await saveLiftupInfo();
            liftUpInfo.enable = true;
            checkLiftUp()
            ctx.reply(`已开启向上爬取，将从 t.me/${CHANNEL_ID}/${startFrom} 开始继续爬取`);
        } else if (ctx.args[0] === 'latest') {
            liftUpInfo.enable = true;
            checkLiftUp()
            delete liftUpInfo.lastId;
            await saveLiftupInfo();
            ctx.reply(`已开启向上爬取，将从最新消息开始爬取`);
        } else {
            liftUpInfo.enable = true;
            checkLiftUp()
            ctx.reply(`已开启向上爬取，将按上次进度继续爬取`);
        }
    })

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
    ])

    !(async () => {
        while (1)
            await bot.launch().then(() => console.log("Telegraf Bot launched"))
    })();

    async function processMessage(message, client: TelegramClient) {
        const channelId: string = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();

        console.log(`[MSG ${channelId}]`, message.text)

        if ([CHANNEL_NUMBER_ID.toString(), '1840302036'].includes(channelId)) {
            await checkMessage(message, client, false);
        }

        setMessageReaction(message.peerId, message.id, "processing", client);

        const res = (await checkMessage(message, client))
        const { duplicateResults, message: msg, msgId } = res
        if (!duplicateResults) {
            setMessageReaction(message.peerId, message.id, "empty", client);
            return;
        }

        const autoReject = channelId === ADMIN_GROUP_ID.toString()

        if (duplicateResults.some(r => r.before.id.startsWith(CHANNEL_NUMBER_ID.toString()) && r.before.id !== r.this.id) && duplicateResults.length < 10) {
            // skip if no duplicated in channel

            const dupMap = {};
            for (const res of duplicateResults) {
                dupMap[res.before.id] ??= [];
                dupMap[res.before.id].push(res);
            }
            const dupMsg = `<u> <b>火星报速讯！</b></u>\n <a href="https://t.me/c/${msgId.replace("::", "/")}">原消息</a>\n\n${Object.entries(dupMap)
                .map(([msgId, dups]: any) =>
                    ` + ${getIdLink(msgId)}
${dups.map(r => `    - <b>${r.checker}</b> ${r.message ?? ''}检出 <b>${Math.ceil(r.confidence * 100)}%</b>`).join('\n')}`)
                .join('\n')
                } 
                    
${autoReject ? '向该消息回应👍表情以拒稿' : '请手动撤稿/拒稿'}`;

            console.log(dupMsg)
            states.discoveredDuplicateToday++;
            states.discoveredDuplicateTotal++;
            saveStates();

            const dupTipsMsg = await client.sendMessage(ADMIN_GROUP_ID, {
                message: dupMsg,
                replyTo: channelId === ADMIN_GROUP_ID.toString() ? msg : undefined,
                parseMode: 'html',
            });

            if (autoReject) {
                duplicateResultStore[dupTipsMsg.id] = {
                    dupMap, dupMsg, dupMsgSimple: `重复的稿件 | 火星机器人检出重复 & ${Object.keys(dupMap).map(v => getIdLink(v)).join(' & ')} `, originMsg: message.id
                }
                saveDuplicateResult()
            }

            setMessageReaction(message.peerId, message.id, "duplicated", client);
        }

        // await client.sendMessage('xinjingmars', {
        //     message: dupMsg,
        //     parseMode: 'html',
        // })

    }

    const checkQueue = async () => {
        if (!busy)
            busy = new Promise(async (rs) => {
                while (messageQueue.length > 0) {
                    const [message, client] = messageQueue.shift()!;

                    // 3 retries
                    for (let i = 0; i < 3; i++) {
                        try {
                            await processMessage(message, client);
                            break;
                        } catch (e) {
                            console.error('Failed to process message: ', e, 'retried for ', i, 'times');
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
                busy = undefined;
                rs(void 0)
            });
        return busy
    }

    client1.addEventHandler(async ({ message }) => {
        //@ts-ignore
        const channelId: string = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();
        console.log("New Message from", channelId)
        if (!([
            ADMIN_GROUP_ID.toString(),
            CHANNEL_NUMBER_ID.toString(),
        ].includes(channelId))) return;

        const textMessage = message.message;
        const reply = (msg) => client1.sendMessage(message.peerId, {
            message: msg,
            replyTo: message.id
        }).catch(console.error)
        if (textMessage?.startsWith('/restart')) {
            await client1.sendMessage(message.peerId, {
                message: '正在重启……',
                replyTo: message.id
            }).catch(console.error)
            process.exit(0)
        }
        if (textMessage?.startsWith('/check')) {
            const messageId = textMessage.split(' ')[1] || (message.replyTo && ((message.chat?.id ?? message.fromId) + "::" + message.replyTo?.replyToMsgId)) || '';
            if (!messageId.includes('::')) reply('请回复消息或提供消息 ID (格式：peerId::msgId)')
            let msg
            try {
                msg = await getMessageById(messageId, client1)
            } catch (e) {
                reply('获取原消息失败')
                return;
            }
            if (!msg) {
                reply('获取原消息失败')
                return;
            }
            const checkingTips = await telegramBot.sendMessage(GROUP_BOT_ID, '正在检查……')
            try {
                console.log(msg)
                const res = (await checkMessage(msg, client1, true, {
                    nocheck: false,
                    channelOnly: false
                }))
                const { duplicateResults, message: msg2, msgId } = res
                duplicateResults.sort((a, b) => b.confidence - a.confidence)
                console.log("Total:", duplicateResults.length)
                telegramBot.editMessageText(GROUP_BOT_ID, checkingTips.message_id, undefined, `检查结果：\n\n${duplicateResults.filter(v => v.confidence > 0).slice(0, 30).map(r => `${getIdLink(r.before.id)} <b>${r.checker}</b> 检出 ${Math.ceil(r.confidence * 100)}%`).join('\n')}`, {
                    parse_mode: "HTML"
                })
            } catch (e) {
                try {
                    telegramBot.editMessageText(GROUP_BOT_ID, checkingTips.message_id, undefined, `检查失败：${e.toString()}`)
                } catch (e2) {
                    client1.sendMessage(ADMIN_GROUP_ID, {
                        message: `检查失败：${e.toString()}\n\n${e2.toString()}`
                    })
                }
            }
        }
        if (textMessage?.startsWith('/relaunch')) {
            bot.launch();
            client1.sendMessage(message.peerId, {
                message: '已重新初始化 API Bot',
                replyTo: message.id
            });
        }
        if (textMessage?.startsWith('/dumpmsg')) {
            const [_, channelId, msgId] = textMessage.split(' ');
            const msg = await getMessageById(`${channelId}::${msgId}`, client1);
            if (!msg) return reply('获取消息失败')
            console.log(JSON.stringify(msg, null, 4))
            return reply('已在控制台输出')
        }

        console.log("New Message: ", message.text, 'sender', message.sender?.id.toString())

        // 对于审核群：1. 首先处理别人投稿的消息，直接入队列  2. 对于 发布人: efsg (https://t.me/iamefsg) 这种消息，获取消息直链，再入队列
        if (message.sender?.id.toString() === BOT_USER_ID && channelId === ADMIN_GROUP_ID.toString()) {
            if (message.text?.startsWith("发布人")) {
                const msgId = (message.entities?.find(v => ((v as unknown as Api.TextUrl)?.url.toString().includes("t.me/xinjingdaily/"))) as unknown as Api.TextUrl)?.url?.split("/").pop();
                if (!msgId) {
                    console.log("从审核群获取消息直链失败")
                    return
                }

                const msg = await getMessageById(CHANNEL_NUMBER_ID + "::" + msgId!, client1);
                if (!msg) return console.log("从审核群获取消息失败")

                messageQueue.push([msg, client1]);
            } else {
                if (message.text?.startsWith("#待审核") || (message.text?.includes("状态:") && message.text?.includes("模式:"))) return;
                messageQueue.push([message, client1]);
            }

            checkQueue();
        }

        // 对于频道：如果不是频道机器人发的，直接入队列
        if (channelId === CHANNEL_NUMBER_ID.toString() && message.postAuthor !== BOT_NAME) {
            messageQueue.push([message, client1]);
            checkQueue();
        }

        // if (channelId === ADMIN_GROUP_ID.toString())
        //     await setMessageReaction(message.peerId, message.id, "enqueued", client1);

    }, new NewMessage({
        // chats: [
        //     CHANNEL_ID, "xinjingmars", "1601858692"
        // ]
    }));

    client1.addEventHandler(event => {
        if (event.className === 'UpdateMessageReactions') {
            if (event.reactions.results[0].reaction.emoticon === '👍') {
                const duplicateInfo = duplicateResultStore[event.msgId]
                if (duplicateInfo) {
                    client1.sendMessage(event.peer, {
                        replyTo: duplicateInfo.originMsg,
                        message: '/no ' + duplicateInfo.dupMsgSimple,
                        parseMode: "html"
                    })
                    delete duplicateResultStore[event.msgId]
                    states.confirmedDuplicateToday++;
                    states.confirmedDuplicateTotal++;
                    saveStates();
                    saveDuplicateResult()
                }
            }
        }
    });
    // await processMessages(await getMessages(CHANNEL_ID));




    const sleep = (ms) => new Promise(rs => setTimeout(rs, ms))
    const keepAlive = async () => {
        const check = async (client) => {
            !(async () => {
                while (1) {
                    await sleep(100);
                    if (!client.connected) {

                        await Promise.race([
                            client.connect(),
                            sleep(1000)
                        ])

                        if (!client.connected) process.exit(0)
                    }
                }
            })()

            !(async () => {
                while (1) {
                    await sleep(30 * 1000);
                    if (await client.checkAuthorization()) {
                        await client.getMe()
                    }
                }
            })()
        }

        check(client1);
        if (ENABLE_CLIENT2)
            check(client2);
    };

    keepAlive();

})();
/*
process.on('uncaughtException', (e) => {
    console.error(e)
})*/
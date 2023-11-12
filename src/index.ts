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

const CHANNEL_ID = 'xinjingdaily';
const CHANNEL_NUMBER_ID = 1434817225;
const CHANNEL_BOT_ID = -1001434817225;
const ADMIN_GROUP_ID = 1601858692;
const GROUP_BOT_ID = -1001601858692;
const map = {
    '1434817225': '心惊报',
    '1601858692': '心惊报审核群',
};


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

const createTextStore = (name: string, defaultv?: any) => {
    let content = defaultv;
    if (existsSync(name))
        content = JSON.parse(readFileSync(name, 'utf-8'));

    return [
        content,
        async () => {
            await writeFile(name + ".tmp", JSON.stringify(content, null, 4));
            if (existsSync(name + ".bak")) await rm(name + ".bak");
            if (existsSync(name)) await rename(name, name + ".bak");
            await rename(name + ".tmp", name);
        }
    ]
}

let liftUpInfo = {
    enable: false,
    lastId: 0,
    ETA: 0,
    state: '闲置',
    total: 0,
    lastProfile: '暂无'
};

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

(async () => {
    const client1 = await createTGClient();
    const client2 = await createTGClient("./SESSION2");
    console.log("Client1:");
    console.log(client1.session.save());
    client1.sendMessage("me",{
        message: 'test'
    })
    console.log("Client2:");
    console.log(client2.session.save());

    const bot = new Telegraf(readFileSync('./TOKEN', 'utf-8'), {
        telegram: { agent: new SocksProxyAgent('socks://192.168.31.1:7890/') }
    })

    // enumerate all groups joined
    await client1.invoke(new Api.messages.GetDialogs({
        limit: 100,
        offsetPeer: new Api.InputPeerEmpty()
    }));

    await client2.invoke(new Api.messages.GetDialogs({
        limit: 100,
        offsetPeer: new Api.InputPeerEmpty()
    }));

    // list all usable reactions in admin group
    // const fullChat = await client1.invoke(new Api.channels.GetFullChannel({
    //     channel: ADMIN_GROUP_ID
    // }));
    // console.log(fullChat.fullChat.availableReactions.reactions);
    // return;

    const [states, saveStates] = createTextStore('states.json', {
        stateMessage: null
    });

    const createStateMessage = async () => {
        if (states.stateMessage) return states.stateMessage
        // await bot.telegram.deleteMessage(GROUP_BOT_ID, states.stateMessage);

        const msg = await bot.telegram.sendMessage(GROUP_BOT_ID, '查重 Bot 正在运行', {
            disable_notification: true
        })

        // pin the msg
        // await bot.telegram.pinChatMessage(GROUP_BOT_ID, msg.message_id, {
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
        await bot.telegram.editMessageText(GROUP_BOT_ID, stateMessage, undefined, `火星波特 ⁜ 正在运行
        [上次更新：${new Date().toLocaleString()}]
        
        ${liftUpInfo.enable ? `${SPLITER}\n向前存储\n当前进度：${liftUpInfo.lastId}\n预计剩余时间：${(liftUpInfo.ETA / 60).toFixed(1)} 小时\n剩余消息：${liftUpInfo.total}\n当前状态：${liftUpInfo.state}\n\n上次 Profile: \n${liftUpInfo.lastProfile}` : ''}
        `, {
            parse_mode: 'HTML'
        })
    }

    updateStateMessage();
    setInterval(updateStateMessage, 5000)
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
            getMediaPath: async () => undefined
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

    const checkMessages = async (msgs, client: TelegramClient, returnFalseChecks = false, { nocheck = false, profile = profiler('check-message-dedup') } = {}) => {
        const allDuplicated: {
            msgId: string,
            message: any,
            duplicateResults: DuplicateResult[]
        }[] = [];
        for (const messageIndex in msgs) {
            const message = msgs[messageIndex];
            if (!msgCollection.findOne({ id: { $eq: message.id } }))
                msgCollection.insert(message);

            if (!message.peerId) continue;
            const msgId = `${message.peerId.channelId ?? message.peerId.groupId}::${message.id}`;
            if (!message.id) continue;

            console.log("Current Message ID:", msgId)

            const duplicateResults: DuplicateResult[] = [];

            profile.start('parse')

            for (const checker in checkers) {
                const collection = getCollection('checkerCollection-' + checker);

                if (collection.findOne({
                    'id': {
                        $eq: msgId
                    }
                }) === null) {
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
                        }
                    }
                    const res = await checkers[checker].generate(ctx);
                    if (res) {
                        const thisResult = { id: msgId, hash: res };
                        collection.insertOne(thisResult);
                        if (!nocheck) {
                            console.log(" = Checking: ", checker, msgId)
                            profile.start('check-' + checker)

                            for (const before of collection.find({ id: { $ne: msgId } })) {
                                // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;
                                if (!before.id.startsWith(CHANNEL_NUMBER_ID)) continue;
                                const ctx = {
                                    before() { return getMessageById(before.id, client) },
                                    this() { return message },
                                    client,
                                    getMediaCached,
                                    getMediaCachedPath
                                }
                                const checkRes: {
                                    isDuplicated: boolean,
                                    confidence: number,
                                    message?: string
                                } = await checkers[checker].checkDuplicate(res, before.hash, ctx);

                                if (checkRes.isDuplicated || returnFalseChecks) {
                                    duplicateResults.push({
                                        ...checkRes,
                                        before,
                                        this: thisResult,
                                        checker
                                    });
                                }
                            }
                        }
                        console.log(' √ Check complete')
                    }
                }
            }

            profile.end()

            if (duplicateResults.length > 0)
                allDuplicated.push({
                    duplicateResults,
                    message,
                    msgId
                });
        }

        return allDuplicated;
    }

    const getMessages = async (id) => ((await client1.getMessages(id, { limit: 30, })).sort((a, b) => a.date - b.date));

    // writeFileSync('./1.json', JSON.stringify(await getMessages('xinjingmars'),null,4))
    const messageQueue: [Api.Message, TelegramClient][] = [];
    const [duplicateResultStore, saveDuplicateResult] = createTextStore('duplicateResult.json', {})

    let busy: Promise<undefined> | undefined = undefined;

    const getIdName = (id) => {


        return id.replace(/(^\d{10,})/g, (m) => map[m] ?? m);
    }

    const getIdLink = (id) => `<a href="https://t.me/c/${id.replace('::', '/')}">${getIdName(id)}</a>`;

    bot.command('help', ctx => ctx.reply(`/help - 此页面
/search [p:页数] <正则> - 搜索
/ping - pong`))

    const searchData: {
        [id: string]: {
            results,
            removeHandle: NodeJS.Timeout
        }
    } = {}

    const generateSearchDocument = (results, searchId, page) => {
        if (typeof page === 'string') page = parseInt(page)
        const displayHash = (hash) => {
            if (typeof hash === "string") return hash.length > 60 ? hash.replace(/\n/g, '').slice(0, 60) + '...' : hash.replace(/\n/g, ' ');
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

        const { msg, btns } = generateSearchDocument(results, searchId, page);

        const msgSent = await ctx.reply(msg, {
            reply_markup: {
                inline_keyboard: btns
            },
            parse_mode: 'HTML'
        });

        searchData[searchId] = {
            results, removeHandle: setTimeout(() => {
                ctx.deleteMessage(msgSent.message_id)
                delete searchData[searchId]
            }, 1000 * 60 * 3)
        }
    })

    bot.action('removeMsg', ctx => ctx.deleteMessage(ctx.message))

    bot.action(/pagination:searchData-(\S+)-(\S+)/, async ctx => {
        const [_, searchId, page] = ctx.match;
        const data = searchData[searchId];
        clearTimeout(data.removeHandle)
        data.removeHandle = setTimeout(() => {
            ctx.deleteMessage()
            delete searchData[searchId]
        }, 1000 * 60 * 3)
        const { msg, btns } = generateSearchDocument(data.results, searchId, page);
        await ctx.editMessageText(msg, {
            reply_markup: {
                inline_keyboard: btns
            },
            parse_mode: 'HTML'
        })
    })

    bot.command('ping', ctx => ctx.reply('pong!'))

    bot.telegram.setMyCommands([
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
        }
    ])

    await bot.launch().then(() => console.log("Telegraf Bot launched"))
    //@ts-ignore
    bot.pooling.stop = console.log

    async function processMessage(message, client: TelegramClient) {
        const channelId = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();

        console.log(`[MSG ${channelId}]`, message.text)

        if ([CHANNEL_NUMBER_ID.toString(), '1840302036'].includes(channelId)) {
            await checkMessages([message], client, false);
        }

        if (channelId === ADMIN_GROUP_ID.toString()) {
            setMessageReaction(message.peerId, message.id, "processing", client);
            if (message.text?.startsWith("#待审核")) return;

            const res = (await checkMessages([message], client))
            const { duplicateResults, message: msg, msgId } = res[0] ?? {}
            console.log(duplicateResults, res)
            if (!duplicateResults) {
                setMessageReaction(message.peerId, message.id, "empty", client);
                return;
            }



            if (duplicateResults.some(r => r.before.id.startsWith(CHANNEL_NUMBER_ID)) && duplicateResults.length < 10) {
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
                    
向该消息回应👍表情以拒稿`;

                console.log(dupMsg)

                const dupTipsMsg = await client.sendMessage(ADMIN_GROUP_ID, {
                    message: dupMsg,
                    replyTo: msg,
                    parseMode: 'html',
                });

                duplicateResultStore[dupTipsMsg.id] = {
                    dupMap, dupMsg, dupMsgSimple: `重复的稿件 | 火星机器人检出重复 & ${Object.keys(dupMap).map(v => getIdLink(v)).join(' & ')} `, originMsg: message.id
                }
                saveDuplicateResult()
                setMessageReaction(message.peerId, message.id, "duplicated", client);
            }

            // await client.sendMessage('xinjingmars', {
            //     message: dupMsg,
            //     parseMode: 'html',
            // })

        }
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
        const channelId = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();
        console.log("New Message from", channelId)
        if (!([
            ADMIN_GROUP_ID.toString(),
            CHANNEL_NUMBER_ID.toString(),
        ].includes(channelId))) return;

        console.log("New Message: ", message.message)

        messageQueue.push([message, client1]);

        // if (channelId === ADMIN_GROUP_ID.toString())
        //     await setMessageReaction(message.peerId, message.id, "enqueued", client1);
        checkQueue();
    }, new NewMessage({
        // chats: [
        //     CHANNEL_ID, "xinjingmars", "1601858692"
        // ]
    }));

    client1.addEventHandler(event => {
        console.log(event.className)
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
                    saveDuplicateResult()
                }
            }
        }
    });
    // await processMessages(await getMessages(CHANNEL_ID));

    (async () => {
        const targetId = 100
        const interval = 10
        let lastUsedTime = 0;
        while (liftUpInfo.enable) {
            const profile = profiler('liftup')
            const lastId = existsSync('lastId.txt') ? parseInt(readFileSync('lastId.txt', 'utf-8')!) : undefined;
            liftUpInfo.lastId = lastId!;
            const ETA = Math.round(((lastId ?? 10000000) - targetId) / 50 * (lastUsedTime / 1000 / 60))
            liftUpInfo.total = (lastId ?? 10000000) - targetId;
            liftUpInfo.ETA = ETA;
            if (lastId && (lastId < 30 || lastId < targetId)) {
                liftUpInfo.enable = false;
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

            const handle = setInterval(() => {
                updateStateMessage()
            }, 20000)

            profile.start('check-message')

            await promisePool(msgs.map((v, i) => {
                const [message, client] = v
                console.log("generate: id:", message.id, "index:", i)
                return async () => {
                    console.log("before exec: id:", message.id, "index:", i, msgs[i][0].id)
                    liftUpInfo.state = `检查中 (${i} / ${msgs.length})`
                    writeFileSync('lastId.txt', message.id.toString());

                    for (let i = 0; i < 3; i++) {
                        try {
                            await checkMessages([message], client, false, { nocheck: true, profile });
                            break;
                        } catch (e) {
                            console.error('Failed to process message: ', e, 'retried for ', i, 'times');
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
            })).promise;

            clearInterval(handle);

            writeFileSync('lastId.txt', (Math.min(...messages.map(v => v.id))).toString());
            liftUpInfo.state = '等待';
            updateStateMessage();
            profile.start('wait')
            await new Promise(rs => setTimeout(rs, interval * 1000));
            const end = Date.now();
            lastUsedTime = end - start;
            liftUpInfo.lastProfile = profile.endPrint()
        }
    })();



    const keepAlive = async () => {
        setInterval(async () => {
            const check = async (client) => {
                if (!client.connected) {
                    await client.connect()
                }

                if (await client.checkAuthorization()) {
                    await client.getMe()
                }
            }

            check(client1);
            check(client2)
        }, 30 * 1000);
    };

    keepAlive();

})();

process.on('uncaughtException', (e) => {
    console.error(e)
})
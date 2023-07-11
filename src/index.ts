import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events"
import input from "input";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Loki from 'lokijs'
import * as phash from "./duplicateChecker/phash";
import * as text from "./duplicateChecker/text";
import * as ocr from "./duplicateChecker/ocr_pear";
import * as mediaId from "./duplicateChecker/mediaId";
import BigInteger from "big-integer";
import { spawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import puppeteer from "puppeteer";
import bigInt from "big-integer";
import { getInputChannel, resolveId } from "telegram/Utils";

const apiId = 24862414;
const apiHash = "1745670d4621f50d831db069ecc40285";

const CHANNEL_ID = 'xinjingdaily';

const db = new Loki('marsBot.db');


db.loadDatabase({}, console.error);
db.autosaveEnable();
db.autosave = true;

const checkers = {
    mediaId,
    phash,
    text,
    ocr
}

const createTGClient: (session?: string) => Promise<TelegramClient> = async (session = "./SESSION") => {
    const stringSession = new StringSession(existsSync(session) ? readFileSync(session, 'utf-8') : '');

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: Infinity,
        autoReconnect: true,
        retryDelay: 1000
    });

    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () =>
            await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });

    return client;
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
(async () => {
    const client = await createTGClient();
    const client2 = await createTGClient("./SESSION2");
    console.log("Client1:");
    console.log(client.session.save());
    console.log("Client2:");
    console.log(client2.session.save());



    const getCollection = (name) => db.getCollection(name) ?? db.addCollection(name, { unique: ['id'] });

    const msgCollection = getCollection('messages');

    const getMessageById: ((id: string, tg: TelegramClient) => any) = async (id, tg = client) => { 
        return await tg.getMessages(new Api.PeerChannel({channelId:bigInt(id.split("::")[0])}), { limit: 1, ids: [parseInt(id.split("::")[1])] });
        const cachedMsg = msgCollection.findOne({ id: { $eq: id } });
        if (cachedMsg) return cachedMsg;
        else {
            const msgs = await tg.getMessages(new Api.PeerChannel({channelId:bigInt(id.split("::")[0])}), { limit: 1, ids: [parseInt(id.split("::")[1])] });
            msgCollection.insert({
                ...msgs[0],
                id: id,
            });
            return msgs[0];
        }
    }

    const getMediaCached = async (msg: Api.Message, tg: TelegramClient = client) => {
        const mediaId = checkers.mediaId.generate({ message: msg, client, getMedia: async () => undefined });
        if (!mediaId) return undefined;
        // find in __dirname/media
        const mediaPath = `./media/${mediaId}`;
        if (existsSync(mediaPath)) return await readFile(mediaPath);
        else {
            const media = await tg.downloadMedia(msg, {});
            if (media)
                await writeFile(mediaPath, media);
            return media;
        }
    }


    const checkMessages = async (msgs, client: TelegramClient, returnFalseChecks = false) => {
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
            for (const checker in checkers) {
                const collection = getCollection('checkerCollection-' + checker);
                if (!collection.findOne({
                    'id': {
                        $eq: msgId
                    }
                })) {
                    console.log(" = Generating: ", checker, msgId)
                    const res = await checkers[checker].generate({
                        message,
                        client,
                        getMedia() {
                            return getMediaCached(message, client);
                        }
                    });

                    console.log(" = Checking: ", checker, msgId)

                    if (res) {
                        const thisResult = { id: msgId, hash: res };
                        collection.insertOne(thisResult);
                        for (const before of collection.find({ id: { $ne: msgId } })) {
                            // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;

                            const ctx = {
                                before() { return getMessageById(before.id, client) },
                                this() { return message },
                                client,
                                getMediaCached
                            }
                            const checkRes: {
                                isDuplicated: boolean,
                                confidence: number
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



            if (duplicateResults.length > 0)
                allDuplicated.push({
                    duplicateResults,
                    message,
                    msgId
                });
        }

        return allDuplicated;
    }

    const getMessages = async (id) => ((await client.getMessages(id, { limit: 30, })).sort((a, b) => a.date - b.date));

    // writeFileSync('./1.json', JSON.stringify(await getMessages('xinjingmars'),null,4))
    const messageQueue: [Api.Message, TelegramClient][] = [];
    let busy = false;

    const getIdName = (id) => {
        const map = {
            '1434817225': '心惊报',
            '1601858692': '心惊报审核群',
        };

        return id.replace(/(^\d{10,})/g, (m) => map[m] ?? m);
    }

    const getIdLink = (id) => `<a href="https://t.me/c/${id.replace('::', '/')}">${getIdName(id)}</a>`;

    async function processMessage(message, client: TelegramClient) {
        const channelId = (message.peerId.channelId || message.peerId.groupId || message.peerId.userId).toString();

        console.log(`[MSG ${channelId}]`, message.text)

        if (['1434817225', '1840302036'].includes(channelId)) {
            await checkMessages([message], client);
        }

        if (message.text.startsWith('!!')) {
            const cmd = message.text.slice(2);
            if (cmd === 'ping') {
                await client.sendMessage(message.peerId, {
                    message: 'pong',
                    replyTo: message.id
                })
            }
            if (cmd.startsWith('search')) {
                const query = cmd.slice(7);
                const pageRegex = /p:(\d+)/;
                const page = pageRegex.test(query) ? parseInt(query.match(pageRegex)[1]) : 1;
                const queryText = query.replace(pageRegex, '').trim();

                const results: any[] = [];
                for (const checker in checkers) {
                    const collection = getCollection('checkerCollection-' + checker);
                    const res = collection.find({
                        'hash': {
                            $regex: queryText
                        }
                    });
                    results.push(...res.map(v => {
                        return {
                            ...v,
                            checker
                        }
                    }));
                }

                const msg = `[ 本消息将会在 3 分钟后删除 ]\n找到 ${results.length} 条结果 (Page ${page})\n\n` + results.slice((page - 1) * 10, page * 10).map((r, i) => `${page * 10 - 10 + i + 1}. (${r.checker}) ${getIdLink(r.id)}:\t
${r.hash.length > 60 ? r.hash.replace(/\n/g, '').slice(0, 60) + '...' : r.hash.replace(/\n/g, ' ')}`).join('\n\n')
                const msgSent = await client.sendMessage(message.peerId, {
                    message: msg,
                    replyTo: message.id,
                    parseMode: 'html'
                });

                setTimeout(() => {
                    client.deleteMessages(message.peerId, [msgSent.id], {})
                }, 1000 * 60 * 3)
            }
            if (cmd.startsWith('query')) {
                const targetMsg = await client.getMessages(
                    message.peerId,
                    {
                        ids: [message.replyTo.replyToMsgId],
                    })[0];

                if (!targetMsg) {
                    await client.sendMessage(message.fromId, {
                        message: '请回复一条消息',
                        replyTo: message.id
                    });
                    return;
                }

                const res: {
                    checker: string,
                    hash: string
                }[] = []
                for (const checker in checkers) {
                    const hash = await checkers[checker].generate({
                        message: targetMsg,
                        client,
                        async getMedia() {
                            return await client.downloadMedia(targetMsg, {});
                        }
                    });
                    res.push({
                        checker,
                        hash
                    });
                }

                await client.sendMessage(message.peerId, {
                    message: `检测结果：\n\n${res.map(r => `**${r.checker}** 特征字符串:\n${r.hash}`).join('\n\n')}`,
                    replyTo: message.id
                });
            }
            return;
        }



        if (channelId === '1601858692') {
            if (message.text?.startsWith("#待审核")) return;

            for (const { duplicateResults, message: msg, msgId } of await checkMessages([message], client)) {
                if (!duplicateResults.some(r => r.before.id.startsWith('1434817225'))) continue;

                const dupMap = {};
                for (const res of duplicateResults) {
                    dupMap[res.before.id] ??= [];
                    dupMap[res.before.id].push(res);
                }
                const dupMsg = `<u> <b>火星报速讯！</b></u>\n <a href="https://t.me/c/${msgId.replace("::", "/")}">原消息</a>\n\n${Object.entries(dupMap)
                    .map(([msgId, dups]: any) =>
                        ` + ${getIdLink(msgId)}
${dups.map(r => `    - <b>${r.checker}</b> 检出 <b>${Math.ceil(r.confidence * 100)}%</b>`).join('\n')}`)
                    .join('\n')
                    } `;

                console.log(dupMsg)
                await client.sendMessage('1601858692', {
                    message: dupMsg,
                    replyTo: msg,
                    parseMode: 'html',
                })

                await client.sendMessage('xinjingmars', {
                    message: dupMsg,
                    parseMode: 'html',
                })
            }
        }
    }

    const checkQueue = async () => {
        if (busy) return;
        busy = true;
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
        busy = false;
    }

    client.addEventHandler(async ({ message }) => {
        messageQueue.unshift([message, client]);
        checkQueue();
    }, new NewMessage({
        // chats: [
        //     CHANNEL_ID, "xinjingmars", "1601858692"
        // ]
    }));

    // await processMessages(await getMessages(CHANNEL_ID));

    (async () => {
        while (0) {
            const lastId = existsSync('lastId.txt') ? parseInt(readFileSync('lastId.txt', 'utf-8')!) : undefined;
            if (lastId && lastId < 30) {
                console.log("[ LiftUp ] Finished!");
                break
            }
            if (lastId)
                console.log("[ LiftUp ] Checking to", lastId, 'ETA: ', Math.round(lastId / 50) + 'mins');
            const messages = ((await client2.getMessages(CHANNEL_ID, { limit: 50, offsetId: lastId })).sort((a, b) => a.date - b.date))
            messageQueue.push(...messages.map(m => [m, client2] as [Api.Message, TelegramClient]));
            checkQueue();

            writeFileSync('lastId.txt', messages[0].id.toString());
            await new Promise(rs => setTimeout(rs, 60 * 1000));
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

            check(client);
            check(client2)
        }, 30 * 1000);
    };

    keepAlive();

})();
import { Api, TelegramClient, tl } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events"

import { existsSync, readFileSync, writeFileSync } from "fs";
import Loki from 'lokijs'
import BigInteger from "big-integer";
import { spawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import puppeteer from "puppeteer";
import bigInt from "big-integer";
import { getInputChannel, resolveId } from "telegram/Utils";

import * as phash from "./duplicateChecker/phash";
import * as text from "./duplicateChecker/text";
import * as ocr from "./duplicateChecker/ocr-pear";
import * as mediaId from "./duplicateChecker/mediaId";
import * as deepDanbooru from "./duplicateChecker/deep-danbooru";
import { createTGClient } from "./tg";

const CHANNEL_ID = 'xinjingdaily';

const db = new Loki('marsBot.db');


db.loadDatabase({}, console.error);
db.autosaveEnable();
db.autosave = true;

const checkers = {
    mediaId,
    phash,
    text,
    ocr,
    deepDanbooru
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
        return (await tg.getMessages(new Api.PeerChannel({ channelId: bigInt(id.split("::")[0]) }), { limit: 1, ids: [parseInt(id.split("::")[1])] }))[0];
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

    const getMediaCachedPath = async (msg: Api.Message, tg: TelegramClient = client) => {
        const mediaId = checkers.mediaId.generate({
            message: msg, client,
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

    const getMediaCached = async (msg: Api.Message, tg: TelegramClient = client) => {
        const path = await getMediaCachedPath(msg, tg);
        if (!path) return;
        return await readFile(path);
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
                        },
                        getMediaPath() {
                            return getMediaCachedPath(message, client);
                        }
                    });

                    console.log(" = Checking: ", checker, msgId)

                    if (res) {
                        const thisResult = { id: msgId, hash: res };
                        collection.insertOne(thisResult);
                        for (const before of collection.find({ id: { $ne: msgId } })) {
                            // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;
                            if (!before.id.startsWith("1434817225")) continue;
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
            if (cmd.toLowerCase().startsWith("checkuser")) {
                const id = cmd.slice(9).trim();
                const json = require(__dirname + "/../cleanout/data/1354938560_participants_channel.json")
                const found = json.participants.find(v => v.userId === id);
                if (found)
                    await client.sendMessage(message.peerId, {
                        message: `在 2023/7/14 的恶俗频道成员备份中找到 ID 为 ${id} 的用户:\n\n${JSON.stringify(found, null, 2)}`,
                    })
                else
                    await client.sendMessage(message.peerId, {
                        message: `在 2023/7/14 的恶俗频道成员备份中没有找到 ID 为 ${id} 的用户`,
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

                    const addResult = (...res) => {
                        results.push(...res.map(v => {
                            return {
                                ...v,
                                checker
                            }
                        }));
                    }
                    if (checker === 'deepDanbooru') {
                        const targetLabels: string[] = queryText.split(',').map(v => v.trim());
                        // 没有不包含的
                        addResult(...
                            collection.where(v => !targetLabels.some(tLabel => !v.hash.some(({ label }) => label === tLabel))));

                    } else {
                        const res = collection.find({
                            'hash': {
                                $regex: queryText
                            }
                        });
                        addResult(...res);
                    }
                }

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

                const msg = `[ 本消息将会在 3 分钟后删除 ]\n找到 ${results.length} 条结果 (Page ${page})\n\n` + results.slice((page - 1) * 10, page * 10)
                    .map((r, i) => `${page * 10 - 10 + i + 1}. (${r.checker}) ${r.message || ''}${getIdLink(r.id)}:\t
${displayHash(r.hash)}`).join('\n\n')
                const msgSent = await client.sendMessage(message.peerId, {
                    message: msg,
                    replyTo: message.id,
                    parseMode: 'html'
                });

                setTimeout(() => {
                    client.deleteMessages(message.peerId, [msgSent.id], {})
                }, 1000 * 60 * 3)
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
${dups.map(r => `    - <b>${r.checker}</b> ${r.message ?? ''}检出 <b>${Math.ceil(r.confidence * 100)}%</b>`).join('\n')}`)
                    .join('\n')
                    } `;

                console.log(dupMsg)

                await client.sendMessage('1601858692', {
                    message: dupMsg,
                    replyTo: msg,
                    parseMode: 'html',
                });



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
        messageQueue.push([message, client]);
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
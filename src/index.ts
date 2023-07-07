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
        connectionRetries: 5,
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


    const checkMessages = async (msgs, client) => {
        const allDuplicated: {
            msgId: string,
            message: any,
            duplicateResults: DuplicateResult[]
        }[] = [];
        for (const messageIndex in msgs) {
            const message = msgs[messageIndex];

            if (!message.peerId) continue;
            const msgId = `${message.peerId.channelId ?? message.peerId.groupId}::${message.id}`;
            if (!message.id) continue;

            const msg = msgCollection.findOne({
                'id': {
                    $eq: msgId
                }
            });
            if (msg || message.text?.includes('【AD】')) {
                continue;
            }
            console.log("Current Message ID:", msgId)

            const duplicateResults: DuplicateResult[] = [];
            let media;
            for (const checker in checkers) {
                const collection = getCollection('checkerCollection-' + checker);
                if (!collection.findOne({
                    'id': {
                        $eq: msgId
                    }
                })) {
                    const res = await checkers[checker].generate({
                        message,
                        client,
                        async getMedia() {
                            if (!media) media = await client.downloadMedia(message, {});
                            return media;
                        }
                    });

                    console.log(" = Checking: ", checker, msgId)

                    if (res) {
                        const thisResult = { id: msgId, hash: res };
                        collection.insertOne(thisResult);
                        for (const before of collection.find({ id: { $ne: msgId } })) {
                            // if(msgs.find(m => m.id === before.id)?.groupedId === message.groupedId) continue;

                            const checkRes: {
                                isDuplicated: boolean,
                                confidence: number
                            } = await checkers[checker].checkDuplicate(res, before.hash);

                            if (checkRes.isDuplicated) {
                                duplicateResults.push({
                                    ...checkRes,
                                    before,
                                    this: thisResult,
                                    checker
                                });
                            }
                        }
                    }
                }


            }



            if (duplicateResults.length > 0)
                allDuplicated.push({
                    duplicateResults,
                    message,
                    msgId
                });
            // if (duplicateResults.length != 0) {
            //     const dupMsg = `火星报速讯！\n${duplicateResults
            //         .map(r => `${r.checker} <a href="https://t.me/${CHANNEL_ID}/${r.before.id}">检出 ${Math.ceil(r.confidence * 100)}%</a>`)
            //         .join('\n')}`;

            //     // let replyToMsg = message, offset = 0;
            //     // while (!message.replies) replyToMsg = msgs[parseInt(messageIndex) - (++offset)];

            //     console.log("🕊️🕊️🕊️ Duplicate detected", msgId, 'DupMsg: ', dupMsg)
            // await client.sendMessage(BigInt('-1001601858692'), {
            //     message: dupMsg,
            //     // commentTo: replyToMsg.id,
            //     parseMode: 'md',
            // })
            // }
        }

        return allDuplicated;
    }

    const getMessages = async (id) => ((await client.getMessages(id, { limit: 30, })).sort((a, b) => a.date - b.date));

    // writeFileSync('./1.json', JSON.stringify(await getMessages('xinjingmars'),null,4))
    client.addEventHandler(async ({ message }) => {
        // @ts-ignore
        const channelId = message.peerId.channelId.toString();

        console.log(`[MSG ${channelId}]`, message.text)


        if (['1434817225', '1840302036'].includes(channelId)) {
            await checkMessages([message], client);
        }

        if (channelId === '1601858692') {
            if (message.text?.startsWith("#待审核")) return;

            for (const { duplicateResults, message: msg, msgId } of await checkMessages([message], client)) {
                if (!duplicateResults.some(r => r.before.id.startsWith('1434817225'))) continue;
                const dupMsg = `<u>火星报速讯！</u>\n<a href="https://t.me/c/${msgId.replace("::", "/")}">原消息</a>\n\n${duplicateResults
                    .map(r =>
                        ` - <b>${r.checker}</b> <a href="https://t.me/c/${r.before.id.replace("::", "/")}">检出 ${Math.ceil(r.confidence * 100)}%</a>`)
                    .join('\n')}`;

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

    }, new NewMessage({
        chats: [
            CHANNEL_ID, "xinjingmars", "1601858692"
        ]
    }));

    // await processMessages(await getMessages(CHANNEL_ID));

    (async () => {
        while (1) {
            const lastId = existsSync('lastId.txt') ? parseInt(readFileSync('lastId.txt', 'utf-8')!) : undefined;
            if(lastId && lastId<30){
                console.log("[ LiftUp ] Finished!");
                break
            }
            if (lastId)
                console.log("[ LiftUp ] Checking to", lastId, 'ETA: ', Math.round(lastId / 50) + 'mins');
            const messages = ((await client2.getMessages(CHANNEL_ID, { limit: 50, offsetId: lastId })).sort((a, b) => a.date - b.date))
            await checkMessages(messages, client2);
            writeFileSync('lastId.txt', messages[0].id.toString());
            await new Promise(rs => setTimeout(rs, 60 * 1000));
        }
    })();

    const keepAlive = async () => {
        setInterval(async () => {
            if (!client.connected) {
                await client.connect()
            }

            if (await client.checkAuthorization()) {
                await client.getMe()
            }
        }, 120 * 1000);
    };

    keepAlive();

})();
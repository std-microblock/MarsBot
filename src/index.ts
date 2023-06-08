import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Loki from 'lokijs'
import * as phash from "./duplicateChecker/phash";
import * as text from "./duplicateChecker/text";
import * as ocr from "./duplicateChecker/ocr";
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

const createTGClient = async () => {
    const stringSession = new StringSession(existsSync('./SESSION') ? readFileSync('./SESSION', 'utf-8') : '');

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

(async () => {
    const client = await createTGClient();
    console.log("You should now be connected.");
    console.log(client.session.save());

    const getCollection = (name) => db.getCollection(name) ?? db.addCollection(name, { unique: ['id'] });

    const msgCollection = getCollection('messages');

    const processMessages = async () => {
        const msgs = ((await client.getMessages(CHANNEL_ID, { limit: 30 })).sort((a, b) => a.date - b.date));
        for (const messageIndex in msgs) {
            const message = msgs[messageIndex];

            const msg = msgCollection.findOne({
                'id': {
                    $eq: message.id
                }
            });
            if (msg || message.text?.includes('【AD】')) {
                continue;
            }

            console.log("Current Message ID:", message.id)

            const duplicateResults: any[] = [];
            let media;
            for (const checker in checkers) {
                const collection = getCollection('checkerCollection-' + checker);
                if (collection.findOne({
                    'id': {
                        $eq: message.id
                    }
                }))
                    continue;

                const res = await checkers[checker].generate({
                    message,
                    client,
                    async getMedia() {
                        if (!media) media = await client.downloadMedia(message, {});
                        return media;
                    }
                });

                console.log("Checking...: ", message.id)

                if (res) {
                    const thisResult = { id: message.id, hash: res };
                    collection.insertOne(thisResult);
                    for (const before of collection.find({ id: { $ne: message.id } })) {
                        
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

            if (duplicateResults.length != 0) {
                const dupMsg = `火星报速讯！\n${duplicateResults
                    .map(r => `${r.checker} 检出 ${r.before.id} ${Math.ceil(r.confidence * 100)}%`) // t.me/${CHANNEL_ID}/
                    .join('\n')}`;

                let replyToMsg = message, offset = 0;
                while (!message.replies) replyToMsg = msgs[parseInt(messageIndex) - (++offset)];

                console.log("🕊️🕊️🕊️ Duplicate detected", message.id, 'DupMsg: ', dupMsg)
                await client.sendMessage(CHANNEL_ID, {
                    message: dupMsg,
                    commentTo: message.id,
                    parseMode: 'md',
                })
            }
        }

    }
    while (1) {
        await processMessages();
        await new Promise(rs => setTimeout(rs, 5000));
    }



})();
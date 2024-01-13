import { existsSync, readFileSync, writeFileSync } from "fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";


const apiId = 24862414;
const apiHash = "1745670d4621f50d831db069ecc40285";


export const createTGClient = async (session = "./SESSION", {
    phone,
    passwd,
} = {
        phone: "",
        passwd: ""
    }) => {
    const stringSession = new StringSession(existsSync(session) ? readFileSync(session, 'utf-8') : '');
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: Infinity,
        autoReconnect: true,
        retryDelay: 1000,
        proxy: {
            MTProxy: false,
            socksType: 5,
            ip: '192.168.31.1',
            port: 7890
        }
    });
    await client.start({
        phoneNumber: async () => phone || await input.text(session + "\nPlease enter your number: "),
        password: async () => passwd || await input.text("Please enter your password: "),
        phoneCode: async () =>
            await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });

    await client.connect();

    writeFileSync(session, stringSession.save());

    return client;
}
import { Api, TelegramClient } from "telegram";

export declare interface CheckerGenerateContext {
    message: Api.Message;
    client: TelegramClient;
    getMedia: () => Promise<string | Buffer | undefined>;
}
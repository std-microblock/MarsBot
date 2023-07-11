import { Api, TelegramClient } from "telegram";

export declare interface CheckerGenerateContext {
    message: Api.Message;
    client: TelegramClient;
    getMedia: () => Promise<string | Buffer | undefined>;
}

export declare interface CheckerCheckContext {
    before: () => Promise<Api.Message>;
    this: () => Promise<Api.Message>;
    client: TelegramClient;
    getMediaCached: (msg: Api.Message) => Promise<string | Buffer | undefined>;
}


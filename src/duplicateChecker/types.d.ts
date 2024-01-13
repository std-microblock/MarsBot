import { Api, TelegramClient } from "telegram";

export declare interface CheckerGenerateContext {
    message: Api.Message;
    client: TelegramClient;
    getMedia: () => Promise<string | Buffer | undefined>;
    getMediaPath: () => Promise<string | undefined>;
    msgId: string;
}

export declare interface CheckerCheckContext {
    before: () => Promise<Api.Message>;
    this: () => Promise<Api.Message>;
    client: TelegramClient;
    beforeId: string;
    thisId: string;
    getMediaCached: (msg: Api.Message) => Promise<string | Buffer | undefined>;
    getMediaCachedPath: (msg: Api.Message) => Promise<string | undefined>;
}

export declare interface GetDuplicatesResult {
    msgId: string;
    confidence: number;
    message?: string;
}

export declare interface GetDuplicatesContext {
    getBeforeResult: (msgId: string) => ({
        hash: string;
    } | null)
}
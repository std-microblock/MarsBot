import { Api, TelegramClient } from 'telegram'
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import { CheckerGenerateContext } from './types';

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    return phash(await client.downloadMedia(message, {}))
}

export const checkDuplicate = async (hash1: string, hash2: string) => {
    const d = dist(hash1, hash2);
    return {
        isDuplicated: d < 15,
        confidence: (15 - d) / 15
    }
}
import { Api, TelegramClient } from 'telegram'
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import { CheckerCheckContext, CheckerGenerateContext } from './types';
import { MARS_PY_API_BASE } from '../api';
import { getMe } from 'telegram/client/users';
import extractFrames from "ffmpeg-extract-frames"
import { join } from 'path';
import { mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';

export const generate = async ({
    message,
    client,
    getMedia,
    getMediaPath
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaDocument' ||
        !(message.media?.document as unknown as Api.Document)?.mimeType?.toLowerCase().includes("video")) return;

    const media = await getMediaPath();
    if (media) {
        if (!existsSync(media + "-frames")) {
            await mkdir(media + "-frames");
            await extractFrames({
                input: media,
                output: media + "-frames/%d.png",
                numFrames: 30
            });
        }

        const mediaFrames = await readdir(media + "-frames");
        const hashes: string[] = [];
        if (mediaFrames.length > 0) {
            for (const frame of mediaFrames) {
                const hash = await phash(join(media + "-frames", frame));
                hashes.push(hash);
            }
        }
        return hashes;
    } else return;
}

export const checkDuplicate = async (hash1: string[], hash2: string[], ctx: CheckerCheckContext) => {
    if(!hash1 || !hash2 || hash1.length !== hash2.length) return {
        isDuplicated: false,
        confidence: 0
    }

    let minDistance = Number.MAX_SAFE_INTEGER, minDistanceProgress = -1;
    for (const i in hash2) {
        const d = dist(hash1[i], hash2[i]);
        if (d < minDistance) {
            minDistance = d;
            minDistanceProgress = parseInt(i) / hash1.length;
        }
    }

    return {
        isDuplicated: minDistance < 15,
        confidence: (15 - minDistance) / 15,
        message: `(At ${(minDistanceProgress * 100).toFixed(2)}%) `
    }
}
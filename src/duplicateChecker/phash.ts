import { Api, TelegramClient } from 'telegram'
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import { CheckerCheckContext, CheckerGenerateContext } from './types';
import { MARS_PY_API_BASE } from '../api';


export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    return phash(await getMedia())
}

export const checkDuplicate = async (hash1: string, hash2: string, ctx: CheckerCheckContext) => {
    const d = dist(hash1, hash2);

    if (d < 16) {
        const beforeMsg = await ctx.before();
        const mediaBefore = beforeMsg ? await ctx.getMediaCached(beforeMsg) as Buffer : undefined;
        const mediaThis = await ctx.getMediaCached(await ctx.this()) as Buffer;
        if (mediaBefore) {
            const body = new FormData();
            body.append('image1', new Blob([mediaBefore]));
            body.append('image2', new Blob([mediaThis]));
            const res = await fetch(`${MARS_PY_API_BASE}/image_similarity`, {
                method: "POST",
                body
            }).then(r => r.json());
            console.log(res.similarity_score);
            if (res.similarity_score > 0.8) return {
                isDuplicated: true,
                confidence: (16 - d) / 16,
                message: `(<b>opencv</b> ${Math.round(res.similarity_score * 1000) / 10}%) `
            }
        }
    }

    return {
        isDuplicated: false,
        confidence: (15 - d) / 15
    }
}
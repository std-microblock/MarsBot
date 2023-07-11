import { Api, TelegramClient } from 'telegram'
import { loadImage, Image } from "canvas";
import { Canvas } from 'canvas';
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import { CheckerCheckContext, CheckerGenerateContext } from './types';
import ssim from "ssim.js";

import { DescriptorMatch, FeatureDetector, Mat } from '@u4/opencv4nodejs';
import * as cv from '@u4/opencv4nodejs';
const getImageData = (img: Image) => {
    const { width, height } = img;
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height);
}

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    return phash(await client.downloadMedia(message, {}))
}

export const checkDuplicate = async (hash1: string, hash2: string, ctx: CheckerCheckContext) => {
    const d = dist(hash1, hash2);

    if (d < 15) {
        const mediaBefore = await ctx.getMediaCached(await ctx.before()) as Buffer;
        const mediaThis = await ctx.getMediaCached(await ctx.this()) as Buffer;
        
       const im1 = cv.imdecode(mediaBefore);
        const im2 = cv.imdecode(mediaThis);
        
    }



    return {
        isDuplicated: d < 15,
        confidence: (15 - d) / 15
    }
}
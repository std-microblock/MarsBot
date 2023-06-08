import { ocrSpace } from 'ocr-space-api-wrapper';
import { CheckerGenerateContext } from './types';
import { compareTwoStrings } from 'string-similarity';
import filetype from 'magic-bytes.js'
import { readFileSync } from 'fs';

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    const mediaBuf = (await getMedia()) as unknown as Buffer;
    console.log("[ OCR ] Recognizing..");
    const apiKeys = readFileSync('./OCR_KEYS', 'utf-8').split('\n');

    while (1) {
        try {
            const res = await ocrSpace(`data:${filetype(mediaBuf)[0].mime?.replace('jpeg', 'jpg')};base64,${(mediaBuf.toString('base64'))}`,
                { apiKey: apiKeys[Math.floor(Math.random() * apiKeys.length)], language: 'chs' });
            const ocrResult = res.ParsedResults.length ? res.ParsedResults.map(v => v.ParsedText).join('\n').trim() : 'No Result';
            console.log('[ OCR ] Result:', ocrResult || 'No Result');
            return ocrResult || 'No Result';
        } catch (e) {
            console.warn("[ OCR ] Error", e);
            await new Promise(rs => setTimeout(rs, 5000));
        }
    }
}

export const checkDuplicate = async (s1: string, s2: string) => {
    const d = compareTwoStrings(s1, s2);
    return {
        isDuplicated: d > 0.8 && !(s1 === 'No Result') && !(s2 === 'No Result'),
        confidence: (d - 0.8) / 0.2
    }
}
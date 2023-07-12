import { ocrSpace } from 'ocr-space-api-wrapper';
import { CheckerGenerateContext } from './types';
import { compareTwoStrings } from 'string-similarity';
import filetype from 'magic-bytes.js'
import { readFileSync } from 'fs';
import { MARS_PY_API_BASE } from '../api';

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    const mediaBuf = (await getMedia()) as unknown as Buffer;
    console.log("[ OCR ] Recognizing..");
    const apiKeys = readFileSync('./OCR_KEYS', 'utf-8').split('\n').filter(v => v);

    while (1) {
        try {
            const apikey = apiKeys[Math.floor(Math.random() * apiKeys.length)].trim();
            const res = await ocrSpace(`data:${filetype(mediaBuf)[0].mime?.replace('jpeg', 'jpg')};base64,${(mediaBuf.toString('base64'))}`,
                { apiKey: apikey, language: 'chs' });
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
    if ([s1, s2].some(v => v === 'No Result')) return {
        isDuplicated: false,
        confidence: 0
    }

    const d = compareTwoStrings(s1, s2);
    if (d > 0.65) {
        const res = await fetch(`${MARS_PY_API_BASE}/text_similarity`, {
            method: "POST",
            body: JSON.stringify({
                "text1": s1,
                "text2": s2
            }),
            headers: {
                "Content-Type": "application/json"
            }
        }).then(r => r.json());
        if (res.similarity_score > 0.8) {
            return {
                isDuplicated: true,
                confidence: (d - 0.65) / (1 - 0.65),
                message: `(<b>AI</b> ${Math.round(res.similarity_score * 1000) / 10}%) `
            }
        }
    }

    return {
        isDuplicated: false,
        confidence: (d - 0.8) / 0.2
    }
}
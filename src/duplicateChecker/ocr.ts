import { ocrSpace } from 'ocr-space-api-wrapper';
import { CheckerGenerateContext, GetDuplicatesResult } from './types';
import { compareTwoStrings } from 'string-similarity';

import { readFileSync } from 'fs';
import { MARS_PY_API_BASE } from '../api';
import { buf2b64Url } from './utils';



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
            const res = await ocrSpace(buf2b64Url(mediaBuf),
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

export const getDuplicates = async (id: string, hash: string): Promise<GetDuplicatesResult[]> => {
    const res = await (await fetch("http://127.0.0.1:5000/text/save_and_find_closest", {
        body: JSON.stringify(
            {
                "text": hash,
                "id": `ocr-${id}`,
            }
        ),
        headers: {
            "Content-Type": "application/json"
        },
        method: "POST"
    })).json()

    return res.map((v: any) => ({
        msgId: v.id.split('-')[1],
        confidence: v.score
    })).filter((v: any) => v.confidence > 0.8)
}

// export const checkDuplicate = async (s1: string, s2: string) => {
//     if ([s1, s2].some(v => v === 'No Result')) return {
//         isDuplicated: false,
//         confidence: 0
//     }

//     const d = compareTwoStrings(s1, s2);
//     if (d > 0.65) {
//         const res = await fetch(`${MARS_PY_API_BASE}/text_similarity`, {
//             method: "POST",
//             body: JSON.stringify({
//                 "text1": s1,
//                 "text2": s2
//             }),
//             headers: {
//                 "Content-Type": "application/json"
//             }
//         }).then(r => r.json());
//         if (res.similarity_score > 0.8) {
//             return {
//                 isDuplicated: true,
//                 confidence: (d - 0.65) / (1 - 0.65),
//                 message: `(<b>AI</b> ${Math.round(res.similarity_score * 1000) / 10}%) `
//             }
//         }
//     }

//     return {
//         isDuplicated: false,
//         confidence: (d - 0.8) / 0.2
//     }
// }
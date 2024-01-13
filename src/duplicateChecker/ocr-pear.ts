import { ocrSpace } from 'ocr-space-api-wrapper';
import { CheckerGenerateContext, GetDuplicatesContext, GetDuplicatesResult } from './types';
import { compareTwoStrings } from 'string-similarity';
import filetype from 'magic-bytes.js'
import { readFileSync, rmdirSync } from 'fs';

import puppeteer, { Browser } from 'puppeteer';
import { RequestInterceptionManager } from 'puppeteer-intercept-and-modify-requests'
import { MARS_PY_API_BASE } from '../api';
import { promisePool } from '../promise-pool';

let recognize: (img: string) => Promise<string> = (img) => { throw Error("Not initialized") };
let browser: Browser | undefined;
async function initializeOCR(pages = 5) {
    if (browser){
        browser.close();
        await new Promise(rs=>setTimeout(rs,5000));
    }
    browser = undefined
    browser = await puppeteer.launch({
        headless: true,
       // userDataDir: __dirname+'/puppeteer_profile'
    });

    const newPage = async () => {
        const page = await browser!.newPage();
        page.setViewport({
            width: 10,
            height: 80
        })

        const client = await page.target().createCDPSession()
        const interceptManager = new RequestInterceptionManager(client as any);

        await interceptManager.intercept(
            {
                urlPattern: `https://pearocr.com/js/668.*.js`,
                resourceType: 'Script',
                modifyResponse({ body }) {
                    setTimeout(() => {
                        interceptManager.disable()
                    }, 100)
                    return {
                        body: body?.replace(/\,(\S+)\.addImage\=/, ',window.antOcr=$1,$1.addImage='),
                    }
                },
            }
        )

        await page.goto('https://pearocr.com/#/');

        page.evaluate(`
            const _refreshItemText = antOcr.refreshItemText
    
        const recognize = (img)=>{
            return Promise.race([new Promise((rs)=>{
                antOcr.deleteAll();
                antOcr.addImage(img);
                
                antOcr.refreshItemText = (e)=>{
                    _refreshItemText(e);
                    rs(antOcr.RecoDataList[0].text);
                    // rs(antOcr.RecoDataList[0].detail.map(v=>v.text).join('\\n'));
                }
            }),new Promise((_,rj)=>setTimeout(rj,20000,'timeout'))])
        }
    
        window.recognize=recognize;`);

        return (img) => {
            // @ts-ignore
            return page.evaluate(async (img) => await window.recognize(img), img) as any
        }
    }

    const pagesRecognizeFunc = await Promise.all(new Array(pages).fill(0).map(v => newPage()))

    const pending = new Array(pages).fill(null);

    const pool = promisePool([], pages, true);
    recognize = (img) => {
        return pool.addTask(async (i) => {
            const page = pending.findIndex(v => !v);
            if (page === -1) throw "No page available"
            console.log("Using page", page)
            pending[page] = true;
            const res = await pagesRecognizeFunc[page](img);
            pending[page] = null;
            return res;
        })
    }
}


initializeOCR();

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    const mediaBuf = (await getMedia()) as unknown as Buffer;
    console.log("[ OCR ] Recognizing..");

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await recognize(`data:${filetype(mediaBuf)[0].mime?.replace('jpeg', 'jpg')};base64,${(mediaBuf.toString('base64'))}`);
            const ocrResult = res?.trim() || 'No Result';
            console.log('[ OCR ] Result:', ocrResult);

            if (ocrResult.length < 10) return 'No Result';
            return ocrResult;
        } catch (e) {
            console.warn("[ OCR ] Error", e);
            initializeOCR();
            await new Promise(rs => setTimeout(rs, 5000));
        }
    }
    console.error("[ OCR ] Failed to recognize");
    return 'No Result'
}

export const getDuplicates = async (id: string, hash: string, ctx: GetDuplicatesContext): Promise<GetDuplicatesResult[]> => {
    const res = await (await fetch("http://127.0.0.1:5000/text/find_closest", {
        body: JSON.stringify(
            {
                "text": hash
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
    })).filter((v: any) => {
        const beforeMsg = ctx.getBeforeResult(v.msgId);
        if (!beforeMsg) return false;
        const d = compareTwoStrings(beforeMsg.hash, hash)
        return d > 0.65
    })
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
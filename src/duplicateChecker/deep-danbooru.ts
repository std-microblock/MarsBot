import { CheckerGenerateContext, CheckerCheckContext } from "./types";
import { buf2b64Url } from "./utils";
import { WebSocket } from "ws";

interface DDSpaceInterface {
    label: string;
    confidence: number;
}

const executeDeepDanbooru = (buf: Buffer) => new Promise<DDSpaceInterface[]>(resolve => {
    const wss = new WebSocket('wss://microblock-deepdanbooru.hf.space/queue/join');

    wss.onmessage = ({ data }) => {
        const info = JSON.parse(data);
        const { msg } = info;
        if (msg === 'send_hash') {
            wss.send('{"fn_index":1,"session_hash":"mdgpm92y2mc"}')
        }

        if (msg === 'send_data') {
            wss.send(JSON.stringify(
                {
                    "data": [
                        buf2b64Url(buf),
                        0.5
                    ],
                    "event_data": null,
                    "fn_index": 1,
                    "session_hash": "mdgpm92y2mc"
                }
            ))
        }

        if (msg === 'process_completed') {
            resolve(info.output.data[0].confidences)
            wss.close();
        }
    }
});

export const generate = async ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    if (message.media?.className !== 'MessageMediaPhoto') return;
    const media = await getMedia();
    const res= await executeDeepDanbooru(media as Buffer);
    console.log("[ DeepDanbooru ] ", res);
    return res;
}

export const checkDuplicate = async (hash1: DDSpaceInterface[], hash2: DDSpaceInterface[], ctx: CheckerCheckContext) => {
    let totalConfidenceDiff = 0;

    const labels = {};
    for (const { label } of hash1) labels[label] = true;
    for (const { label } of hash2) labels[label] = true;

    for (const label in labels) {
        const a = hash1.find(v => v.label === label)?.confidence || 0;
        const b = hash2.find(v => v.label === label)?.confidence || 0;
        totalConfidenceDiff += Math.abs(a - b);
    }

    console.log(totalConfidenceDiff)

    return {
        isDuplicated: totalConfidenceDiff < 0.3,
        confidence: (0.3 - totalConfidenceDiff) / 0.3
    }
}
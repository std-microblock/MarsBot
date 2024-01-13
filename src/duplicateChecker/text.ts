import { Api } from "telegram";
import { compareTwoStrings } from "string-similarity";
import { CheckerCheckContext, CheckerGenerateContext, GetDuplicatesContext, GetDuplicatesResult } from "./types";

const preprocess = (text: string) => text.replace(/#\S+/, '').split(/via|from/)[0].trim()

export const generate = async ({
    message,
    msgId
}: CheckerGenerateContext) => {
    const ppc = preprocess(message.text).trim();
    if(ppc.length === 0) return undefined;
    await (await fetch("http://127.0.0.1:5000/text/save_text_embedding", {
        body: JSON.stringify(
            {
                "text": ppc,
                "id": `text-${msgId}`,
            }
        ),
        headers: {
            "Content-Type": "application/json"
        },
        method: "POST"
    })).text()
    return message.replies ? ppc : undefined;
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
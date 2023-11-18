import { Api } from "telegram";
import { compareTwoStrings } from "string-similarity";
import { CheckerGenerateContext } from "./types";

const preprocess = (text: string) => text.replace(/#\S+/, '').split(/via|from/)[0].trim()

export const generate = ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => message.replies ? preprocess(message.text) : undefined;

export const checkDuplicate = async (s1: string, s2: string) => {
    s1 = preprocess(s1)
    s2 = preprocess(s2)
    const d = compareTwoStrings(s1, s2);
    const isOneLine = (txt) => !txt.includes('\n')
    return {
        isDuplicated: d > 0.8 && !isOneLine(s1) && !isOneLine(s2),
        confidence: (d - 0.8) / 0.2
    }
}
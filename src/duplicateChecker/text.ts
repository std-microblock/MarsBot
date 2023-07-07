import { Api } from "telegram";
import { compareTwoStrings } from "string-similarity";
import { CheckerGenerateContext } from "./types";

export const generate = ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => message.replies ? message.text : undefined;

export const checkDuplicate = async (s1: string, s2: string) => {
    const d = compareTwoStrings(s1, s2);
    const isOneLine = (txt) => !txt.includes('\n')
    return {
        isDuplicated: d > 0.8 && !isOneLine(s1) && !isOneLine(s2),
        confidence: (d - 0.8) / 0.2
    }
}
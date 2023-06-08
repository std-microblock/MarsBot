import { CheckerGenerateContext } from "./types";

export const generate = ({
    message,
    client,
    getMedia
}: CheckerGenerateContext) => {
    for (const mediaSlot in message.media) {
        if (message.media[mediaSlot].id)
            return `${mediaSlot}-id-${message.media[mediaSlot].id}`;
    }
    return undefined;
}

export const checkDuplicate = async (s1: string, s2: string) => {

    return {
        isDuplicated: s1 === s2,
        confidence: 1
    }
}
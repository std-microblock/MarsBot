!(async () => {
    const { readFileSync, readdirSync, rmSync, writeFileSync, renameSync, existsSync } = require("fs");
    const name = 'ocr'
    const decodeUrlSafeBase64 = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const encodeUrlSafeBase64 = (str) => Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
    const ids = readdirSync('./ai/data/text_similarity').map(v => decodeUrlSafeBase64(/embedding_msgid_(.*?).pt/.exec(v)[1]))

    const data = JSON.parse(readFileSync('marsBot.db', 'utf8'))
    const collection = data.collections.find(v => v.name === 'checkerCollection-' + name)
    const preprocess = (text) => text.replace(/#\S+/, '').split(/via|from/)[0].trim()
    // console.log(ids)
    let i = 0;
    for (const doc of collection.data) {
        if (!doc.hash || doc.hash === 'No Result') continue;

        const txt = preprocess(doc.hash).trim();
        i++;
        if(txt.length === 0) continue;
        if (ids.includes(`${name}-${doc.id}`)) continue;
        process.stdout.write(`${i}/${collection.data.length} ${(i / collection.data.length * 100).toFixed(2)}%\r`);
        const res = await (await fetch("http://127.0.0.1:5100/text/save_text_embedding", {
            body: JSON.stringify(
                {
                    "text": txt,
                    "id": `${name}-${doc.id}`,
                }
            ),
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST"
        })).text()
        // process.stdout.write(res+'\r')
    }

    // writeFileSync('marsBot.db', JSON.stringify(data))
})()
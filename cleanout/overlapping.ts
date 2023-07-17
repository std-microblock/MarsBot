import { readFileSync, writeFileSync } from "fs";
import { Api } from "telegram";
import { createTGClient } from "../src/tg";
import bigint from "big-integer";

!(async () => {
    const client = await createTGClient("./SESSION3");
    await client.connect();

    // let result = await client.invoke(
    //     new Api.channels.GetFullChannel({
    //         channel: "https://t.me/xinjingdailychatroom",
    //     })
    // );
    const id = 'xinjingdailychatroom'//result.chats[1].id;
    const peer = await client.getPeerId(id);
    const parts = await client.getParticipants(peer);
    // p.fullChat[0].id
    writeFileSync(`./${id}_participants.json`, JSON.stringify(parts, null, 4));

    const pat135 = JSON.parse(readFileSync('./1354938560_participants.json').toString());
    const pat135channel = JSON.parse(readFileSync('./1354938560_participants_channel.json').toString());
    writeFileSync(`./${id}_overlapping_admin.json`, JSON.stringify(
        pat135.filter(user135 => parts.some(user2 => user2.id.toString() === user135.id) &&
        pat135channel.participants.find(user2 => user2.userId === user135.id)?.adminRights
        ), null, 4));
    console.log("Done")
})();

!(async () => {
    const client = await createTGClient("./SESSION2");
    await client.connect();

    let result = await client.invoke(
        new Api.channels.GetFullChannel({
            channel: "acgdaily",
        })
    );
    const id = result.chats[1].id;

    const parts = await client.invoke(
        new Api.channels.GetParticipants({
            channel: id,
            filter: new Api.ChannelParticipantsRecent(),
            // offset: 43,
            limit: 3000,
            hash: bigint("-4156887774564"),
        })
    );

    writeFileSync(`./${id}_participants.json`, JSON.stringify(await client.getParticipants(id), null, 4));
    writeFileSync(`./${id}_participants_channel.json`, JSON.stringify(parts, null, 4));
    console.log("Job Finished")
})
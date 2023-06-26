import * as fs from "fs";
import crypto from "crypto";

import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { SimplePool, nip19, getPublicKey, finishEvent } from "nostr-tools";
import "websocket-polyfill";

const createContent = (post) => {
  const hash = generateHash(
    post.pubkey,
    withoutTime(new Date(post.created_at * 1000))
  );
  const index = convertToNumber(hash, nips.length - 1);
  const nip = nips[index];
  return `今日のラッキー NIP

${nip[0]}
https://github.com/nostr-protocol/nips/blob/master/${nip[1]}`;
};
const createTags = (post) => {
  const pTags = post.tags.filter(
    (tag) => tag[0] == "p" && tag[1] != post.pubkey
  );
  return [...pTags, ["e", post.id, "", "root"], ["p", post.pubkey]];
};
const convertToNumber = (hash, range) => {
  const decimal = parseInt(hash, 16);
  return decimal % (range + 1);
};
const generateHash = (value1, value2) => {
  const hash = crypto.createHash("sha256");
  hash.update(value1.toString());
  hash.update(value2.toString());
  return hash.digest("hex");
};
const unixTimeNow = () => Math.floor(Date.now() / 1000);
const withoutTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const nips = fs
  .readFileSync("nips.csv")
  .toString()
  .split("\n")
  .map((line) => line.split(","));
const relays = JSON.parse(process.env.RELAYS.replace(/'/g, '"'));
const sk = nip19.decode(process.env.NSEC).data;
const pk = getPublicKey(sk);

const date = parseInt(fs.readFileSync("date.txt"));
const now = unixTimeNow();

fs.writeFileSync("date.txt", now.toString());

const pool = new SimplePool();
const posts = (
  await pool.list(relays, [
    {
      kinds: [1],
      "#p": [pk],
      since: date,
      until: now,
    },
  ])
).filter((post) => post.tags.every((tag) => tag[0] != "e"));
const replies = posts.map((post) =>
  finishEvent(
    {
      kind: 1,
      created_at: unixTimeNow(),
      tags: createTags(post),
      content: createContent(post),
    },
    sk
  )
);
await Promise.all(
  replies.map(
    (reply) =>
      new Promise((resolve, reject) => {
        const pub = pool.publish(relays, reply);
        pub.on("ok", resolve);
        pub.on("failed", reject);
      })
  )
);
pool.close(relays);

process.exit();

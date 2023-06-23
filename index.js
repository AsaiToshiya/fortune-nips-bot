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
  const hasETag = post.tags.some((tag) => tag[0] == "e");
  return [
    ...pTags,
    ["e", post.id, "", hasETag ? "reply" : "root"],
    ["p", post.pubkey],
  ];
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
const withoutTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// prettier-ignore
const nips = [
  ["NIP-01: Basic protocol flow description", "01.md"],
  ["NIP-02: Contact List and Petnames", "02.md"],
  ["NIP-03: OpenTimestamps Attestations for Events", "03.md"],
  ["NIP-04: Encrypted Direct Message", "04.md"],
  ["NIP-05: Mapping Nostr keys to DNS-based internet identifiers", "05.md"],
  ["NIP-06: Basic key derivation from mnemonic seed phrase", "06.md"],
  ["NIP-07: `window.nostr` capability for web browsers", "07.md"],
  ["NIP-08: Handling Mentions", "08.md"],
  ["NIP-09: Event Deletion", "09.md"],
  ["NIP-10: Conventions for clients' use of `e` and `p` tags in text events", "10.md"],
  ["NIP-11: Relay Information Document", "11.md"],
  ["NIP-12: Generic Tag Queries", "12.md"],
  ["NIP-13: Proof of Work", "13.md"],
  ["NIP-14: Subject tag in text events.", "14.md"],
  ["NIP-15: Nostr Marketplace (for resilient marketplaces)", "15.md"],
  ["NIP-16: Event Treatment", "16.md"],
  ["NIP-18: Reposts", "18.md"],
  ["NIP-19: bech32-encoded entities", "19.md"],
  ["NIP-20: Command Results", "20.md"],
  ["NIP-21: `nostr:` URL scheme", "21.md"],
  ["NIP-22: Event `created_at` Limits", "22.md"],
  ["NIP-23: Long-form Content", "23.md"],
  ["NIP-25: Reactions", "25.md"],
  ["NIP-26: Delegated Event Signing", "26.md"],
  ["NIP-27: Text Note References", "27.md"],
  ["NIP-28: Public Chat", "28.md"],
  ["NIP-30: Custom Emoji", "30.md"],
  ["NIP-31: Dealing with Unknown Events", "31.md"],
  ["NIP-32: Labeling", "32.md"],
  ["NIP-33: Parameterized Replaceable Events", "33.md"],
  ["NIP-36: Sensitive Content", "36.md"],
  ["NIP-39: External Identities in Profiles", "39.md"],
  ["NIP-40: Expiration Timestamp", "40.md"],
  ["NIP-42: Authentication of clients to relays", "42.md"],
  ["NIP-45: Counting results", "45.md"],
  ["NIP-46: Nostr Connect", "46.md"],
  ["NIP-47: Wallet Connect", "47.md"],
  ["NIP-50: Keywords filter", "50.md"],
  ["NIP-51: Lists", "51.md"],
  ["NIP-56: Reporting", "56.md"],
  ["NIP-57: Lightning Zaps", "57.md"],
  ["NIP-58: Badges", "58.md"],
  ["NIP-65: Relay List Metadata", "65.md"],
  ["NIP-78: Application-specific data", "78.md"],
  ["NIP-89: Recommended Application Handlers", "89.md"],
  ["NIP-94: File Metadata", "94.md"],
  ["NIP-98: HTTP Auth", "98.md"],
];
const relays = JSON.parse(process.env.RELAYS.replace(/'/g, '"'));
const sk = nip19.decode(process.env.NSEC).data;
const pk = getPublicKey(sk);

const date = parseInt(fs.readFileSync("date.txt"));
const now = Math.floor(Date.now() / 1000);

fs.writeFileSync("date.txt", now.toString());

const pool = new SimplePool();
await Promise.all(
  (
    await pool.list(relays, [
      {
        kinds: [1],
        "#p": [pk],
        since: date,
        until: now,
      },
    ])
  )
    .filter((post) => post.tags.every((tag) => tag[0] != "e"))
    .map((post) =>
      finishEvent(
        {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: createTags(post),
          content: createContent(post),
        },
        sk
      )
    )
    .map(
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

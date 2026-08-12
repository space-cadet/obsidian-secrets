import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const files = ["main.js", "manifest.json", "styles.css"];
for (const file of files) readFileSync(join(root, file));

const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const archiveName = `${manifest.id}-v${manifest.version}.zip`;
const archivePath = join(dist, archiveName);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (~crc) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

const date = new Date();
const entries = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(`${manifest.id}/${file}`);
  const content = readFileSync(join(root, file));
  const checksum = crc32(content);
  const local = Buffer.concat([
    Buffer.from("PK\x03\x04"), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(checksum), u32(content.length), u32(content.length), u16(name.length), u16(0), name,
  ]);
  const central = Buffer.concat([
    Buffer.from("PK\x01\x02"), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(checksum), u32(content.length), u32(content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
  ]);
  entries.push({ local, content, central });
  offset += local.length + content.length;
}

const centralDirectory = Buffer.concat(entries.map((entry) => entry.central));
const end = Buffer.concat([
  Buffer.from("PK\x05\x06"), u16(0), u16(0), u16(entries.length), u16(entries.length),
  u32(centralDirectory.length), u32(offset), u16(0),
]);
writeFileSync(archivePath, Buffer.concat([
  ...entries.flatMap((entry) => [entry.local, entry.content]),
  centralDirectory,
  end,
]));

for (const file of files) writeFileSync(join(dist, file), readFileSync(join(root, file)));
const sha256 = (file) => createHash("sha256").update(readFileSync(join(dist, file))).digest("hex");
const checksumLines = [...files, archiveName]
  .map((file) => `${sha256(file)}  ${file}`)
  .join("\n");
writeFileSync(join(dist, "CHECKSUMS.txt"), `${checksumLines}\n`);
console.log(`Created dist/${archiveName} (${statSync(archivePath).size} bytes)`);

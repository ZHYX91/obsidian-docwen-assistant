const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const DOS_DATE_1980_01_01 = 0x0021;
const FILE_MODE_100644 = 0x81a40000;

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

export function createDeterministicZip(entries) {
  const ordered = [...entries]
    .map(({ name, data }) => ({ name: normalizeName(name), data: Buffer.from(data) }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (ordered.length === 0) throw new Error("ZIP must contain at least one entry");
  if (new Set(ordered.map(({ name }) => name)).size !== ordered.length) {
    throw new Error("ZIP entry names must be unique");
  }

  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const { name, data } of ordered) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(STORE_METHOD, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(STORE_METHOD, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(FILE_MODE_100644, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(ordered.length, 8);
  end.writeUInt16LE(ordered.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

export function readDeterministicZip(value) {
  const buffer = Buffer.from(value);
  if (buffer.length < 22) throw new Error("ZIP is truncated");
  const endOffset = buffer.length - 22;
  if (buffer.readUInt32LE(endOffset) !== 0x06054b50) throw new Error("ZIP end record is missing");
  if (
    buffer.readUInt16LE(endOffset + 4) !== 0 ||
    buffer.readUInt16LE(endOffset + 6) !== 0 ||
    buffer.readUInt16LE(endOffset + 20) !== 0
  ) {
    throw new Error("ZIP disks or comments are not allowed");
  }
  const entryCount = buffer.readUInt16LE(endOffset + 8);
  if (entryCount === 0 || buffer.readUInt16LE(endOffset + 10) !== entryCount) {
    throw new Error("ZIP entry count is invalid");
  }
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) throw new Error("ZIP central directory boundary is invalid");

  const localEntries = [];
  let localOffset = 0;
  while (localOffset < centralOffset) {
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP local record is invalid");
    const flags = buffer.readUInt16LE(localOffset + 6);
    const method = buffer.readUInt16LE(localOffset + 8);
    const crc = buffer.readUInt32LE(localOffset + 14);
    const compressedSize = buffer.readUInt32LE(localOffset + 18);
    const uncompressedSize = buffer.readUInt32LE(localOffset + 22);
    const nameLength = buffer.readUInt16LE(localOffset + 26);
    const extraLength = buffer.readUInt16LE(localOffset + 28);
    if (
      buffer.readUInt16LE(localOffset + 4) !== 20 ||
      flags !== UTF8_FLAG ||
      method !== STORE_METHOD ||
      buffer.readUInt16LE(localOffset + 10) !== 0 ||
      buffer.readUInt16LE(localOffset + 12) !== DOS_DATE_1980_01_01 ||
      compressedSize !== uncompressedSize ||
      nameLength === 0 ||
      extraLength !== 0
    ) {
      throw new Error("ZIP local metadata is not deterministic");
    }
    const nameStart = localOffset + 30;
    const dataStart = nameStart + nameLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) throw new Error("ZIP local payload crosses the central directory");
    const name = buffer.subarray(nameStart, dataStart).toString("utf8");
    if (Buffer.byteLength(name, "utf8") !== nameLength || normalizeName(name) !== name) {
      throw new Error(`ZIP entry name is not canonical: ${name}`);
    }
    const data = buffer.subarray(dataStart, dataEnd);
    if (crc32(data) !== crc) throw new Error(`ZIP CRC mismatch: ${name}`);
    localEntries.push({ crc, data: Buffer.from(data), localOffset, name });
    localOffset = dataEnd;
  }
  if (localOffset !== centralOffset || localEntries.length !== entryCount) {
    throw new Error("ZIP local record count or boundary is invalid");
  }

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP central record is invalid");
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const next = nameStart + nameLength + extraLength + commentLength;
    if (
      buffer.readUInt16LE(cursor + 4) !== 0x0314 ||
      buffer.readUInt16LE(cursor + 6) !== 20 ||
      buffer.readUInt16LE(cursor + 8) !== UTF8_FLAG ||
      buffer.readUInt16LE(cursor + 10) !== STORE_METHOD ||
      buffer.readUInt16LE(cursor + 12) !== 0 ||
      buffer.readUInt16LE(cursor + 14) !== DOS_DATE_1980_01_01 ||
      buffer.readUInt32LE(cursor + 20) !== buffer.readUInt32LE(cursor + 24) ||
      extraLength !== 0 ||
      commentLength !== 0 ||
      buffer.readUInt16LE(cursor + 34) !== 0 ||
      buffer.readUInt16LE(cursor + 36) !== 0 ||
      buffer.readUInt32LE(cursor + 38) !== FILE_MODE_100644
    ) {
      throw new Error("ZIP central metadata is not deterministic");
    }
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const local = localEntries[index];
    if (
      name !== local.name ||
      buffer.readUInt32LE(cursor + 16) !== local.crc ||
      buffer.readUInt32LE(cursor + 20) !== local.data.length ||
      buffer.readUInt32LE(cursor + 42) !== local.localOffset
    ) {
      throw new Error(`ZIP central/local record mismatch: ${name}`);
    }
    entries.push(Object.freeze({ name, data: Buffer.from(local.data), mode: 0o100644 }));
    cursor = next;
  }
  if (cursor !== endOffset) throw new Error("ZIP central directory size is invalid");
  const names = entries.map(({ name }) => name);
  const orderedNames = [...names].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(names) !== JSON.stringify(orderedNames) || new Set(names).size !== names.length) {
    throw new Error("ZIP entries must be unique and sorted");
  }
  return Object.freeze(entries);
}

function normalizeName(name) {
  const normalized = String(name).replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    normalized.includes("\0") ||
    /^[A-Za-z]:/u.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe ZIP entry name: ${name}`);
  }
  return normalized;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

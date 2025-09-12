const { base58 } = require("@scure/base");
const crypto = require("crypto");
const sha256 = require("sha256");
const RIPEMD160 = require("ripemd160");
const pkg = require("elliptic");
const ec = new pkg.ec("secp256k1");

function getPubKeyFromPrivate(pri) {
  try {
    const key = ec.keyFromPrivate(pri);
    return key.getPublic().encode("hex", false);
  } catch (e) {
    console.log("getPubKeyFromPrivateBase58");
    console.log(e);
  }
}

function convertToBase58(pubAddress, chainPrefix) {
  const prefix = "83";
  const resultStr = base58extracted(pubAddress, prefix);

  // Noble @scure/base ile güvenli encoding
  const data = Buffer.from(resultStr, "hex");
  const prefixBuffer = Buffer.from(prefix, "hex");

  // base58check standardı: prefix + data + checksum
  const combined = Buffer.concat([prefixBuffer, data]);
  let hash = crypto.createHash("sha256").update(combined).digest();
  hash = crypto.createHash("sha256").update(hash).digest();
  const checksum = hash.slice(0, 4);

  const finalData = Buffer.concat([prefixBuffer, data, checksum]);
  const b58 = base58.encode(finalData);

  return { pub: pubAddress, base58: (chainPrefix ?? "PR") + b58 };
}

function base58extracted(publicKey, prefix) {
  publicKey = sha256.x2(publicKey);
  publicKey = new RIPEMD160().update(publicKey).digest("hex");
  const secondHash = prefix + publicKey;
  let hashLast = sha256.x2(secondHash);
  hashLast = sha256.x2(hashLast);
  const firstByte = hashLast.substr(0, 8);
  return secondHash + firstByte;
}

module.exports = {
  getPubKeyFromPrivate,
  convertToBase58,
  base58extracted,
};

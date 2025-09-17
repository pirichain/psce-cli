const { base58extracted } = require("./utility");
const bs58 = require("bs58");
const crypto = require("crypto");
const bip39 = require("bip39");
const pkg = require("elliptic");
const ec = new pkg.ec("secp256k1");

function createNewAddress(chainPrefix) {
  const key = ec.genKeyPair();
  const prefix = "83";
  let publicKey = key.getPublic("hex");
  let _publicKey = publicKey;
  const privateKey = key.getPrivate("hex");
  const resultStr = base58extracted(publicKey, prefix);

  // Noble @scure/base ile güvenli encoding
  const data = Buffer.from(resultStr, "hex");
  const prefixBuffer = Buffer.from(prefix, "hex");

  // base58check standardı: prefix + data + checksum
  const combined = Buffer.concat([prefixBuffer, data]);
  let hash = crypto.createHash("sha256").update(combined).digest();
  hash = crypto.createHash("sha256").update(hash).digest();
  const checksum = hash.slice(0, 4);

  const finalData = Buffer.concat([prefixBuffer, data, checksum]);
  const b58 = bs58.encode(finalData);

  bip39.setDefaultWordlist("english");
  const words = bip39.entropyToMnemonic(privateKey);
  return {
    data: {
      pri: privateKey,
      pub: (chainPrefix ?? "PR") + b58,
      words: words,
      publicKey: _publicKey,
    },
  };
}

module.exports = { createNewAddress };

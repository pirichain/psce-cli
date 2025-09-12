const sanitize = require("mongo-sanitize");
const bip39 = require("bip39");
const { getPubKeyFromPrivate, convertToBase58 } = require("./utility");

function rescuePrivateKey(words, chainPrefix) {
  bip39.setDefaultWordlist("english");

  words = sanitize(words);
  let pri = "";
  try {
    pri = bip39.mnemonicToEntropy(words);
    let pubKey = getPubKeyFromPrivate(pri);
    if (!pubKey) {
      throw new Error("Public key generation failed");
    }
    let base58 = convertToBase58(pubKey, chainPrefix);
    return { data: { pri: pri, base58: base58 } };
  } catch (e) {
    return {
      data: {
        error: 1,
        message: "There is an error. Check your mnemonic words!",
      },
    };
  }
}

module.exports = { rescuePrivateKey };

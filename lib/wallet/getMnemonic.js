const bip39 = require("bip39");
const sanitize = require("mongo-sanitize");

function getMnemonic(privateKey) {
  privateKey = sanitize(privateKey);
  bip39.setDefaultWordlist("english");
  try {
    const mnemonic = bip39.entropyToMnemonic(privateKey);
    return { data: { error: 0, mnemonic: mnemonic } };
  } catch (e) {
    return {
      data: { error: 1, message: "There is an error. Check your private key!" },
    };
  }
}

module.exports = { getMnemonic };

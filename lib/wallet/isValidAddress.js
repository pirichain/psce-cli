const { base58 } = require("@scure/base");
const crypto = require("crypto");

function isValidAddress(address) {
  try {
    // Chain prefix'ini kaldır - sadece belirli prefix'leri kabul et
    let chainPrefix = "";

    // Bilinen prefix'leri kontrol et (2-5 karakter arası A-Z)
    const possiblePrefixes = ["PR", "TZ", "MR", "AA", "PS", "CHAIN"]; // Örnekler

    for (const prefix of possiblePrefixes) {
      if (address.startsWith(prefix)) {
        chainPrefix = prefix;
        break;
      }
    }

    // Eğer bilinen prefix yoksa, A-Z harfleriyle başlayan kısmı prefix olarak al
    if (!chainPrefix) {
      let i = 0;
      while (i < address.length && address[i] >= "A" && address[i] <= "Z") {
        i++;
      }
      chainPrefix = address.slice(0, i);
    }

    const base58Part = address.slice(chainPrefix.length);

    // Noble base58 ile decode et
    const decoded = base58.decode(base58Part);
    const decodedBuffer = Buffer.from(decoded);

    // Son 4 byte checksum, geriye kalan data
    const checksum = decodedBuffer.slice(-4);
    const data = decodedBuffer.slice(0, -4);

    // Checksum doğrulaması (double SHA256)
    let hash = crypto.createHash("sha256").update(data).digest();
    hash = crypto.createHash("sha256").update(hash).digest();
    const expectedChecksum = hash.slice(0, 4);

    // Checksum karşılaştırması
    return checksum.equals(expectedChecksum);
  } catch {
    return false;
  }
}

module.exports = { isValidAddress };

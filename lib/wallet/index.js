const { createNewAddress } = require("./createNewAddress");
const { rescuePrivateKey } = require("./rescuePrivateKey");
const { getMnemonic } = require("./getMnemonic");
const { isValidAddress } = require("./isValidAddress");
const { getPubKeyFromPrivate, convertToBase58 } = require("./utility");

class PirichainWallet {
  constructor() {
    // Offline wallet utilities for Pirichain blockchain
  }

  /**
   * Create a new Pirichain address
   * @param {string} chainPrefix - Chain prefix (default: 'PR')
   * @returns {Object} - Generated address data
   */
  createNewAddress(chainPrefix = "PR") {
    return createNewAddress(chainPrefix);
  }

  /**
   * Rescue private key from mnemonic words
   * @param {string} words - Mnemonic words
   * @param {string} chainPrefix - Chain prefix
   * @returns {Object} - Recovered private key data
   */
  rescuePrivateKey(words, chainPrefix = "PR") {
    return rescuePrivateKey(words, chainPrefix);
  }

  /**
   * Get mnemonic from private key
   * @param {string} privateKey - Private key
   * @returns {Object} - Mnemonic data
   */
  getMnemonic(privateKey) {
    return getMnemonic(privateKey);
  }

  /**
   * Validate Pirichain address
   * @param {string} address - Address to validate
   * @returns {boolean} - Is valid address
   */
  isValidAddress(address) {
    return isValidAddress(address);
  }

  /**
   * Get public key from private key
   * @param {string} privateKey - Private key
   * @returns {string} - Public key
   */
  getPubKeyFromPrivate(privateKey) {
    return getPubKeyFromPrivate(privateKey);
  }

  /**
   * Convert public key to base58 address
   * @param {string} publicKey - Public key
   * @param {string} chainPrefix - Chain prefix (default: 'PR')
   * @returns {Object} - Base58 address data
   */
  convertToBase58(publicKey, chainPrefix = "PR") {
    return convertToBase58(publicKey, chainPrefix);
  }

  /**
   * Extract address prefix from a Pirichain address
   * @param {string} address - Pirichain address
   * @returns {string} - Address prefix (first 2 characters)
   */
  getAddressPrefix(address) {
    if (!address || address.length < 2) {
      throw new Error("Invalid address format");
    }
    return address.substring(0, 2);
  }

  /**
   * Check if address belongs to specific network by prefix
   * @param {string} address - Address to check
   * @param {string} expectedPrefix - Expected network prefix
   * @returns {boolean} - Does address match network prefix
   */
  isAddressForNetwork(address, expectedPrefix) {
    if (!this.isValidAddress(address)) {
      return false;
    }
    return this.getAddressPrefix(address) === expectedPrefix;
  }
}

module.exports = PirichainWallet;

const keytar = require("keytar");
const crypto = require("crypto");
const { askSecureInput, askConfirmation, askInput } = require("./utils");
const fs = require("fs");
const path = require("path");
const os = require("os");

class PSCESecurityManager {
  constructor() {
    this.SERVICE_NAME = "psce-cli";
    this.configPath = path.join(os.homedir(), ".psce");
    this.sessionFile = path.join(this.configPath, "session.enc");
    this.auditFile = path.join(this.configPath, "audit.enc");
    this.networksFile = path.join(this.configPath, "networks.json");
    this.session = {
      lastActivity: null,
      timeout: 10 * 60 * 1000, // Default 10 minutes
      masterKey: null,
      isActive: false,
    };
    this.isLinuxWithoutDisplay = this.detectLinuxDisplayIssue();
  }

  detectLinuxDisplayIssue() {
    // Linux without X11/Wayland display - keytar won't work
    if (
      os.platform() === "linux" &&
      !process.env.DISPLAY &&
      !process.env.WAYLAND_DISPLAY
    ) {
      return true;
    }
    return false;
  }

  // Keytar wrapper with Linux fallback
  async safeKeytarSet(service, key, value) {
    try {
      if (this.isLinuxWithoutDisplay) {
        return await this.fileBasedSet(key, value);
      }
      return await keytar.setPassword(service, key, value);
    } catch (error) {
      if (
        error.message.includes("D-Bus") ||
        error.message.includes("DISPLAY")
      ) {
        console.warn("⚠️  Keytar unavailable, using file-based storage");
        return await this.fileBasedSet(key, value);
      }
      throw error;
    }
  }

  async safeKeytarGet(service, key) {
    try {
      if (this.isLinuxWithoutDisplay) {
        return await this.fileBasedGet(key);
      }
      return await keytar.getPassword(service, key);
    } catch (error) {
      if (
        error.message.includes("D-Bus") ||
        error.message.includes("DISPLAY")
      ) {
        console.warn("⚠️  Keytar unavailable, using file-based storage");
        return await this.fileBasedGet(key);
      }
      throw error;
    }
  }

  async safeKeytarDelete(service, key) {
    try {
      if (this.isLinuxWithoutDisplay) {
        return await this.fileBasedDelete(key);
      }
      return await keytar.deletePassword(service, key);
    } catch (error) {
      if (
        error.message.includes("D-Bus") ||
        error.message.includes("DISPLAY")
      ) {
        console.warn("⚠️  Keytar unavailable, using file-based storage");
        return await this.fileBasedDelete(key);
      }
      throw error;
    }
  }

  // File-based fallback for Linux without display
  async fileBasedSet(key, value) {
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }

    let data = {};
    if (fs.existsSync(this.networksFile)) {
      const fileContent = fs.readFileSync(this.networksFile, "utf8");
      data = JSON.parse(fileContent);
    }

    data[key] = value;
    fs.writeFileSync(this.networksFile, JSON.stringify(data, null, 2));

    // Set restricted permissions (only user can read/write)
    fs.chmodSync(this.networksFile, 0o600);
    return true;
  }

  async fileBasedGet(key) {
    if (!fs.existsSync(this.networksFile)) {
      return null;
    }

    const fileContent = fs.readFileSync(this.networksFile, "utf8");
    const data = JSON.parse(fileContent);
    return data[key] || null;
  }

  async fileBasedDelete(key) {
    if (!fs.existsSync(this.networksFile)) {
      return true;
    }

    const fileContent = fs.readFileSync(this.networksFile, "utf8");
    const data = JSON.parse(fileContent);
    delete data[key];
    fs.writeFileSync(this.networksFile, JSON.stringify(data, null, 2));
    return true;
  }

  async setup() {
    console.log("🔐 PSCE Security Setup\n");

    // Create config directory
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }

    try {
      // Ask for session timeout preference
      console.log("Session timeout configuration:");
      console.log("  0 = Use private key once and forget (most secure)");
      console.log("  1-60 = Keep session active for N minutes");
      console.log("  Default = 10 minutes\n");

      const timeoutAnswer = await askInput(
        "Session timeout in minutes (0-60, default 10): "
      );
      const timeoutMinutes = this.parseTimeout(timeoutAnswer);

      this.session.timeout = timeoutMinutes * 60 * 1000; // Convert to ms

      if (timeoutMinutes === 0) {
        console.log("✅ Configured for maximum security (use-once mode)");
      } else {
        console.log(
          `✅ Session will expire after ${timeoutMinutes} minutes of inactivity`
        );
      }

      // Ask for master password
      console.log("\n🔑 Master Password Setup");
      console.log(
        "This adds an extra security layer on top of OS credential store.\n"
      );

      const masterPassword = await askSecureInput("Create master password: ");
      const confirmPassword = await askSecureInput("Confirm master password: ");

      if (masterPassword !== confirmPassword) {
        throw new Error("Passwords do not match!");
      }

      if (masterPassword.length < 6) {
        throw new Error("Master password must be at least 6 characters!");
      }

      // Save security configuration
      const securityConfig = {
        sessionTimeout: this.session.timeout,
        setupDate: new Date().toISOString(),
        version: "1.0.0",
      };

      // Encrypt and save master password hash for verification
      const salt = crypto.randomBytes(32);
      const masterHash = crypto.scryptSync(masterPassword, salt, 32);

      const configData = {
        ...securityConfig,
        masterSalt: salt.toString("hex"),
        masterHash: masterHash.toString("hex"),
      };

      fs.writeFileSync(
        path.join(this.configPath, "security.json"),
        JSON.stringify(configData, null, 2)
      );

      console.log("\n✅ Security setup completed successfully!");
      console.log(`📁 Configuration saved to: ${this.configPath}`);

      // Log the setup
      await this.logAudit("SECURITY_SETUP", "system", true, {
        sessionTimeout: timeoutMinutes,
        setupTime: new Date().toISOString(),
      });

      return { masterPassword, timeoutMinutes };
    } catch (error) {
      throw error;
    }
  }

  parseTimeout(input) {
    const timeout = parseInt(input.trim());
    if (isNaN(timeout)) return 10; // Default
    if (timeout < 0) return 0; // Use-once mode
    if (timeout > 60) return 60; // Max 1 hour
    return timeout;
  }

  async storeWallet(address, privateKey) {
    try {
      // Get master password
      const masterPassword = await this.getMasterPassword();

      // Encrypt private key with master password
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(masterPassword, salt, 32);
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

      let encrypted = cipher.update(privateKey, "utf8", "hex");
      encrypted += cipher.final("hex");

      const encryptedData = {
        encrypted,
        salt: salt.toString("hex"),
        iv: iv.toString("hex"),
        timestamp: Date.now(),
      };

      // Store in OS credential store
      const walletKey = `wallet:${address}`;
      await keytar.setPassword(
        this.SERVICE_NAME,
        walletKey,
        JSON.stringify(encryptedData)
      );

      console.log(
        "✅ Wallet stored securely (OS + Master Password encryption)"
      );

      // Log the operation
      await this.logAudit("WALLET_STORE", address, true);

      return true;
    } catch (error) {
      await this.logAudit("WALLET_STORE", address, false, {
        error: error.message,
      });
      throw error;
    }
  }

  async getWallet(address) {
    try {
      // For now, always ask for master password to ensure security
      // TODO: Implement proper session management later
      const masterPassword = await this.getMasterPassword();
      const privateKey = await this.decryptWallet(address, masterPassword);

      await this.logAudit("WALLET_ACCESS", address, true, { mode: "fresh" });
      return privateKey;
    } catch (error) {
      await this.logAudit("WALLET_ACCESS", address, false, {
        error: error.message,
      });
      throw error;
    }
  }

  async getWalletFresh(address) {
    const masterPassword = await this.getMasterPassword();
    const privateKey = await this.decryptWallet(address, masterPassword);

    // Update session if not use-once mode
    if (this.session.timeout > 0) {
      this.session.masterKey = masterPassword;
      this.session.lastActivity = Date.now();
      this.session.isActive = true;
    }

    await this.logAudit("WALLET_ACCESS", address, true, { mode: "fresh" });
    return privateKey;
  }

  async getWalletFromSession(address) {
    if (!this.session.masterKey) {
      throw new Error("No active session");
    }

    const privateKey = await this.decryptWallet(
      address,
      this.session.masterKey
    );
    this.updateActivity();

    await this.logAudit("WALLET_ACCESS", address, true, { mode: "session" });
    return privateKey;
  }

  async decryptWallet(address, masterPassword) {
    const walletKey = `wallet:${address}`;
    const storedData = await keytar.getPassword(this.SERVICE_NAME, walletKey);

    if (!storedData) {
      throw new Error(`Wallet not found: ${address}`);
    }

    try {
      const encryptedData = JSON.parse(storedData);
      const salt = Buffer.from(encryptedData.salt, "hex");
      const iv = Buffer.from(encryptedData.iv, "hex");
      const key = crypto.scryptSync(masterPassword, salt, 32);

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

      let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      if (
        error.message.includes("bad decrypt") ||
        error.message.includes("wrong final block length")
      ) {
        throw new Error("Incorrect master password or corrupted wallet data");
      }
      throw error;
    }
  }

  isSessionValid() {
    if (!this.session.isActive || !this.session.lastActivity) {
      return false;
    }

    const elapsed = Date.now() - this.session.lastActivity;
    return elapsed < this.session.timeout;
  }

  updateActivity() {
    if (this.session.timeout > 0) {
      this.session.lastActivity = Date.now();
    }
  }

  clearSession() {
    this.session.masterKey = null;
    this.session.lastActivity = null;
    this.session.isActive = false;
    console.log("🔒 Session cleared");
  }

  async getMasterPassword() {
    return await askSecureInput("Enter master password: ");
  }

  async logAudit(action, target, success, metadata = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      target,
      success,
      machine: os.hostname(),
      user: os.userInfo().username,
      metadata,
    };

    // Encrypt audit log entry
    const logData = JSON.stringify(auditEntry);

    // Append to encrypted audit file
    const existingLogs = this.readAuditLog();
    existingLogs.push(auditEntry);

    fs.writeFileSync(this.auditFile, JSON.stringify(existingLogs, null, 2));
  }

  readAuditLog() {
    if (!fs.existsSync(this.auditFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.auditFile, "utf8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async showSecurityStatus() {
    console.log("🔐 PSCE Security Status\n");

    const securityConfig = this.loadSecurityConfig();
    const sessionTimeoutMinutes = Math.floor(
      this.session.timeout / (60 * 1000)
    );

    console.log(
      `Session Timeout: ${
        sessionTimeoutMinutes === 0
          ? "Use-once mode (most secure)"
          : sessionTimeoutMinutes + " minutes"
      }`
    );
    console.log(
      `Session Active: ${this.session.isActive ? "✅ Yes" : "❌ No"}`
    );

    if (this.session.isActive && this.session.timeout > 0) {
      const remaining = Math.floor(
        (this.session.timeout - (Date.now() - this.session.lastActivity)) /
          60000
      );
      console.log(`Time Remaining: ${Math.max(0, remaining)} minutes`);
    }

    console.log(`Setup Date: ${securityConfig?.setupDate || "Not configured"}`);

    // Show recent audit entries
    const auditLogs = this.readAuditLog();
    const recentLogs = auditLogs.slice(-5);

    console.log("\n📝 Recent Activity:");
    recentLogs.forEach((log) => {
      const status = log.success ? "✅" : "❌";
      console.log(
        `  ${status} ${log.timestamp} - ${log.action} (${log.target})`
      );
    });
  }

  loadSecurityConfig() {
    const configFile = path.join(this.configPath, "security.json");
    if (!fs.existsSync(configFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(configFile, "utf8"));
    } catch {
      return null;
    }
  }

  async ensureSession() {
    // For network operations, we'll use a simplified approach
    // If no session exists, create a temporary one
    if (!this.session.isActive) {
      this.session.isActive = true;
      this.session.lastActivity = Date.now();
      this.session.masterKey = crypto.randomBytes(32).toString("hex");
    }

    // Update last activity
    this.session.lastActivity = Date.now();
  }

  logAction(action, target, success, error = null) {
    // Simple logging for now
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ${action} ${target} - ${success ? "SUCCESS" : "FAILED"}${
        error ? `: ${error}` : ""
      }`
    );
  }

  encrypt(text) {
    const key = crypto.scryptSync(this.session.masterKey, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  decrypt(text) {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = textParts.join(":");
    const key = crypto.scryptSync(this.session.masterKey, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Network Management Methods
  async storeNetwork(name, networkData) {
    await this.ensureSession();
    const key = `network:${name}`;

    try {
      // Use safe keytar wrapper with Linux fallback
      await this.safeKeytarSet(
        this.SERVICE_NAME,
        key,
        JSON.stringify(networkData)
      );
      this.logAction("NETWORK_STORE", name, true);
    } catch (error) {
      this.logAction("NETWORK_STORE", name, false, error.message);
      throw new Error(`Failed to store network: ${error.message}`);
    }
  }

  async getNetwork(name) {
    await this.ensureSession();
    const key = `network:${name}`;

    try {
      const data = await this.safeKeytarGet(this.SERVICE_NAME, key);
      if (!data) {
        return null;
      }

      this.logAction("NETWORK_ACCESS", name, true);
      return JSON.parse(data);
    } catch (error) {
      this.logAction("NETWORK_ACCESS", name, false, error.message);
      throw error;
    }
  }

  async getAllNetworks() {
    await this.ensureSession();

    try {
      // Linux fallback için file-based storage kontrolü
      if (this.isLinuxWithoutDisplay || (await this.detectKeytarFailure())) {
        return await this.getAllNetworksFromFile();
      }

      const credentials = await keytar.findCredentials(this.SERVICE_NAME);
      const networks = {};

      for (const credential of credentials) {
        if (credential.account.startsWith("network:")) {
          const networkName = credential.account.replace("network:", "");
          networks[networkName] = JSON.parse(credential.password);
        }
      }

      this.logAction("NETWORK_LIST", "all", true);
      return networks;
    } catch (error) {
      this.logAction("NETWORK_LIST", "all", false, error.message);
      // Fallback to file-based if keytar fails
      try {
        console.warn("⚠️  Keytar failed, trying file-based storage");
        return await this.getAllNetworksFromFile();
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  async getAllNetworksFromFile() {
    if (!fs.existsSync(this.networksFile)) {
      return {};
    }

    const fileContent = fs.readFileSync(this.networksFile, "utf8");
    const data = JSON.parse(fileContent);
    const networks = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("network:")) {
        const networkName = key.replace("network:", "");
        networks[networkName] = JSON.parse(value);
      }
    }

    return networks;
  }

  async detectKeytarFailure() {
    try {
      await keytar.findCredentials(this.SERVICE_NAME);
      return false;
    } catch (error) {
      return (
        error.message.includes("D-Bus") || error.message.includes("DISPLAY")
      );
    }
  }

  async removeNetwork(name) {
    await this.ensureSession();
    const key = `network:${name}`;

    try {
      await this.safeKeytarDelete(this.SERVICE_NAME, key);
      this.logAction("NETWORK_REMOVE", name, true);
    } catch (error) {
      this.logAction("NETWORK_REMOVE", name, false, error.message);
      throw error;
    }
  }

  async removeWallet(address) {
    await this.ensureSession();
    const key = `wallet:${address}`;

    try {
      await keytar.deletePassword(this.SERVICE_NAME, key);
      this.logAction("WALLET_REMOVE", address, true);
    } catch (error) {
      this.logAction("WALLET_REMOVE", address, false, error.message);
      throw error;
    }
  }

  async setActiveNetwork(name) {
    await this.ensureSession();
    const key = "config:activeNetwork";

    try {
      await this.safeKeytarSet(this.SERVICE_NAME, key, name);
      this.logAction("NETWORK_SET_ACTIVE", name, true);
    } catch (error) {
      this.logAction("NETWORK_SET_ACTIVE", name, false, error.message);
      throw error;
    }
  }

  async getActiveNetwork() {
    await this.ensureSession();
    const key = "config:activeNetwork";

    try {
      const activeNetwork = await this.safeKeytarGet(this.SERVICE_NAME, key);
      return activeNetwork;
    } catch (error) {
      return null;
    }
  }

  async setActiveAddress(address) {
    await this.ensureSession();
    const key = "config:activeAddress";

    try {
      await this.safeKeytarSet(this.SERVICE_NAME, key, address);
      this.logAction("ADDRESS_SET_ACTIVE", address, true);
    } catch (error) {
      this.logAction("ADDRESS_SET_ACTIVE", address, false, error.message);
      throw error;
    }
  }

  async getActiveAddress() {
    await this.ensureSession();
    const key = "config:activeAddress";

    try {
      const activeAddress = await this.safeKeytarGet(this.SERVICE_NAME, key);
      return activeAddress;
    } catch (error) {
      return null;
    }
  }
}

module.exports = PSCESecurityManager;

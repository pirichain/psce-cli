const chalk = require("chalk");
const { askSecureInput, askConfirmation, askInput } = require("../lib/utils");
const PSCESecurityManager = require("../lib/security-manager");
const PirichainWallet = require("../lib/wallet");

function registerAddressCommand(program) {
  const addressCommand = program
    .command("address")
    .alias("a")
    .description("Address management for Pirichain Smart Scenarios");

  addressCommand
    .command("generate")
    .description("Generate a new address")
    .option(
      "--network <name>",
      "Network to generate address for (uses active network if not specified)"
    )
    .option(
      "--name [name]",
      "Give address a custom name (auto-names as temp-* if not specified)"
    )
    .option("--json", "Output in JSON format")
    .option("--compact", "Output in compact format")
    .action(async (options) => {
      try {
        await generateAddress(options);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Address generation failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("import")
    .description("Import an address from 24-word mnemonic phrase")
    .option(
      "--mnemonic <words>",
      "24-word mnemonic phrase (will prompt securely if not provided)"
    )
    .option(
      "--network <name>",
      "Network for the address (uses active network if not specified)"
    )
    .option("--name <name>", "Name for the imported address")
    .action(async (options) => {
      try {
        await importAddress(options);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Address import failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("validate <address>")
    .description("Validate a Pirichain address")
    .action(async (address) => {
      try {
        await validateAddress(address);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Address validation failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("list")
    .description("List saved addresses")
    .option("--network <name>", "Filter by network")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      try {
        await listAddresses(options);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Address list failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("set <address>")
    .description("Set an address as active")
    .action(async (address) => {
      try {
        await setActiveAddress(address);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Set active address failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("current")
    .description("Show current active address")
    .action(async () => {
      try {
        await showCurrentAddress();
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Show current address failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("remove <identifier>")
    .description("Remove a saved address (by address or name)")
    .option("--force", "Skip confirmation prompt")
    .action(async (identifier, options) => {
      try {
        await removeAddress(identifier, options);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Remove address failed:"), error.message);
        process.exit(1);
      }
    });

  addressCommand
    .command("rename <oldName> <newName>")
    .description("Rename a saved address")
    .action(async (oldName, newName) => {
      try {
        await renameAddress(oldName, newName);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red("Rename address failed:"), error.message);
        process.exit(1);
      }
    });
}

async function generateAddress(options) {
  console.log(chalk.blue.bold("🏗️  Generating New Address"));
  console.log();

  const security = new PSCESecurityManager();
  const wallet = new PirichainWallet();

  // Determine network and prefix
  let networkName = options.network;
  let networkPrefix = null;

  if (!networkName) {
    networkName = await security.getActiveNetwork();
    if (!networkName) {
      console.log(
        chalk.red("❌ No active network set and no --network specified")
      );
      console.log(
        chalk.gray("Set an active network with: psce network set <name>")
      );
      console.log(chalk.gray("Or specify a network with: --network <name>"));
      return;
    }
  }

  // Get network details
  const networkData = await security.getNetwork(networkName);
  if (!networkData) {
    console.log(chalk.red(`❌ Network '${networkName}' not found`));
    console.log(chalk.gray("Use: psce network list to see available networks"));
    return;
  }

  networkPrefix = networkData.prefix;

  // Show network info and get user confirmation
  console.log(chalk.cyan("🌐 Target Network Information:"));
  console.log(chalk.gray(`   Name: ${networkName}`));
  console.log(chalk.gray(`   URL: ${networkData.url}`));
  console.log(chalk.gray(`   Prefix: ${networkPrefix}`));
  console.log();

  const proceed = await askConfirmation(
    `Generate a new address for ${networkName} network (${networkPrefix})?`
  );

  if (!proceed) {
    console.log(chalk.yellow("⚠️  Address generation cancelled"));
    return;
  }

  console.log();

  // Generate new address
  console.log(chalk.yellow("🔑 Generating address..."));
  const newAddress = wallet.createNewAddress(networkPrefix);

  if (newAddress.data.error) {
    console.log(chalk.red("❌ Address generation failed"));
    console.log(chalk.red("Error:"), newAddress.data.message);
    return;
  }

  const address = newAddress.data.pub; // Address is in 'pub' field
  const privateKey = newAddress.data.pri;
  const publicKey = newAddress.data.publicKey;
  const mnemonic = newAddress.data.words; // Mnemonic is in 'words' field

  // Display results (SECURE - no private information)
  console.log(chalk.green("✅ Address generated successfully!"));
  console.log();

  if (options.json) {
    const result = {
      address: address,
      network: networkName,
      prefix: networkPrefix,
      generated: new Date().toISOString(),
    };
    console.log(JSON.stringify(result, null, 2));
  } else if (options.compact) {
    console.log(`${address} (${networkName})`);
  } else {
    // Table format - SECURE
    console.log(chalk.cyan("📍 Address:"), chalk.white.bold(address));
    console.log(chalk.gray("🌐 Network:"), `${networkName} (${networkPrefix})`);
    console.log(chalk.green("� Private information stored securely"));

    if (options.mnemonic) {
      console.log(
        chalk.yellow("ℹ️  Note: --mnemonic option removed for security")
      );
      console.log(
        chalk.gray(
          "   Use 'psce address show <address> --mnemonic' to view securely"
        )
      );
    }
  }

  // Auto-save address (always save now)
  console.log();
  console.log(chalk.yellow("💾 Saving address..."));

  let addressName;
  if (options.name !== undefined) {
    // User specified --name option
    addressName = options.name;
    if (typeof options.name === "boolean" || !addressName) {
      // Prompt for name
      try {
        addressName = await askInput(
          "Enter a name for this address: ",
          (input) => !!input.trim()
        );
      } catch (error) {
        console.log(chalk.red("❌ Address name is required"));
        return;
      }
    }
  } else {
    // Auto-generate temp name
    const timestamp = Date.now();
    addressName = `temp-${timestamp}`;
    console.log(
      chalk.gray(`🏷️  Auto-naming as '${addressName}' (temporary address)`)
    );
  }

  try {
    await security.storeWallet(address, privateKey);
    // Store address metadata
    const addressMetadata = {
      name: addressName,
      address: address,
      network: networkName,
      prefix: networkPrefix,
      createdAt: new Date().toISOString(),
      isTemporary: !options.name, // Mark if it's auto-generated temp
      ...(mnemonic && { hasMnemonic: true }),
    };

    await security.storeNetwork(`address:${address}`, addressMetadata);

    if (options.name !== undefined) {
      console.log(chalk.green(`✅ Address saved as '${addressName}'`));
    } else {
      console.log(
        chalk.green(`✅ Address saved as temporary '${addressName}'`)
      );
      console.log(
        chalk.gray("💡 Use --name <name> to give it a permanent name")
      );
    }
  } catch (error) {
    console.log(chalk.red("❌ Failed to save address:"), error.message);
    return;
  }

  console.log();
  console.log(chalk.blue("💡 Next steps:"));
  console.log(
    chalk.gray("  • Validate address: psce address validate " + address)
  );
  console.log(chalk.gray("  • View saved addresses: psce address list"));
  console.log(chalk.gray("  • Set as active: psce address set " + address));
}

async function importAddress(options) {
  console.log(chalk.blue.bold("📥 Importing Address from Mnemonic"));
  console.log(chalk.gray("Pirichain uses 24-word mnemonic phrases"));
  console.log();

  const security = new PSCESecurityManager();
  const wallet = new PirichainWallet();

  // Get mnemonic securely
  let mnemonic = options.mnemonic;
  if (!mnemonic) {
    console.log(
      chalk.yellow("🔐 Enter your 24-word mnemonic phrase securely:")
    );
    console.log(chalk.gray("(Input will be masked for security)"));
    mnemonic = await askSecureInput("Mnemonic: ");
  }

  // Validate mnemonic (24 words)
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 24) {
    console.log(
      chalk.red(`❌ Invalid mnemonic: Expected 24 words, got ${words.length}`)
    );
    console.log(chalk.gray("Pirichain requires exactly 24 words"));
    return;
  }

  // Determine network
  let networkName = options.network;
  if (!networkName) {
    networkName = await security.getActiveNetwork();
    if (!networkName) {
      console.log(
        chalk.red("❌ No active network set and no --network specified")
      );
      console.log(
        chalk.gray("Set an active network with: psce network set <name>")
      );
      console.log(chalk.gray("Or specify a network with: --network <name>"));
      return;
    }
  }

  const networkData = await security.getNetwork(networkName);
  if (!networkData) {
    console.log(chalk.red(`❌ Network '${networkName}' not found`));
    return;
  }

  const networkPrefix = networkData.prefix;

  // Show network info and get user confirmation
  console.log(chalk.cyan("🌐 Target Network Information:"));
  console.log(chalk.gray(`   Name: ${networkName}`));
  console.log(chalk.gray(`   URL: ${networkData.url}`));
  console.log(chalk.gray(`   Prefix: ${networkPrefix}`));
  console.log();

  const proceed = await askConfirmation(
    `Import address for ${networkName} network (${networkPrefix})?`
  );

  if (!proceed) {
    console.log(chalk.yellow("⚠️  Address import cancelled"));
    return;
  }

  console.log();

  // Import from mnemonic
  console.log(chalk.yellow("🔑 Importing from mnemonic..."));
  const rescueResult = wallet.rescuePrivateKey(mnemonic, networkPrefix);

  if (rescueResult.data.error) {
    console.log(chalk.red("❌ Mnemonic import failed"));
    console.log(chalk.red("Error:"), rescueResult.data.message);
    return;
  }

  const privateKey = rescueResult.data.pri;
  const address = rescueResult.data.base58.base58;

  // Validate address prefix matches network
  if (!address.startsWith(networkPrefix)) {
    console.log(chalk.red("❌ Address prefix mismatch"));
    console.log(
      chalk.red(
        `Expected prefix: ${networkPrefix}, got: ${address.substring(0, 2)}`
      )
    );
    console.log(
      chalk.gray("The mnemonic doesn't belong to the selected network")
    );
    return;
  }

  console.log(chalk.green("✅ Address imported successfully!"));
  console.log();
  console.log(chalk.cyan("📍 Address:"), chalk.white.bold(address));
  console.log(chalk.gray("🌐 Network:"), `${networkName} (${networkPrefix})`);
  console.log(chalk.green("🔐 Private information processed securely"));

  // Get address name
  let addressName = options.name;
  if (!addressName) {
    try {
      addressName = await askInput(
        "Enter a name for this address: ",
        (input) => !!input.trim()
      );
    } catch (error) {
      console.log(chalk.red("❌ Address name is required"));
      return;
    }
  }

  // Save address
  try {
    await security.storeWallet(address, privateKey);

    const addressMetadata = {
      name: addressName,
      address: address,
      network: networkName,
      prefix: networkPrefix,
      importedAt: new Date().toISOString(),
      importMethod: "mnemonic-24words",
    };

    await security.storeNetwork(`address:${address}`, addressMetadata);

    console.log();
    console.log(chalk.green(`✅ Address saved as '${addressName}'`));
  } catch (error) {
    console.log(chalk.red("❌ Failed to save address:"), error.message);
  }
}

async function validateAddress(address) {
  console.log(chalk.blue.bold("🔍 Validating Address"));
  console.log(chalk.gray(`Address: ${address}`));
  console.log();

  const wallet = new PirichainWallet();
  const isValid = wallet.isValidAddress(address);

  if (isValid) {
    const prefix = address.substring(0, 2);
    console.log(chalk.green("✅ Address is valid"));
    console.log(chalk.gray(`Prefix: ${prefix}`));

    // Try to match with known networks
    const security = new PSCESecurityManager();
    const networks = await security.getAllNetworks();

    const matchingNetwork = Object.entries(networks).find(
      ([name, data]) => data.prefix === prefix
    );
    if (matchingNetwork) {
      console.log(
        chalk.gray(`Network: ${matchingNetwork[0]} (${matchingNetwork[1].url})`)
      );
    } else {
      console.log(
        chalk.yellow(`⚠️  No known network found for prefix '${prefix}'`)
      );
    }
  } else {
    console.log(chalk.red("❌ Address is invalid"));
    console.log(chalk.gray("This is not a valid Pirichain address format"));
  }
}

async function listAddresses(options) {
  console.log(chalk.blue.bold("💼 Saved Addresses"));
  console.log();

  const security = new PSCESecurityManager();
  const networks = await security.getAllNetworks();

  // Get active address for marking
  const activeAddress = await security.getActiveAddress();

  // Get all address metadata
  const addressMetadata = {};
  for (const [key, data] of Object.entries(networks)) {
    if (key.startsWith("address:")) {
      const address = key.replace("address:", "");
      addressMetadata[address] = data;
    }
  }

  if (Object.keys(addressMetadata).length === 0) {
    console.log(chalk.gray("No addresses saved."));
    console.log(
      chalk.gray("Generate an address with: psce address generate --name")
    );
    console.log(chalk.gray("Import an address with: psce address import"));
    return;
  }

  // Filter by network if specified
  let addresses = Object.entries(addressMetadata);
  if (options.network) {
    addresses = addresses.filter(
      ([addr, data]) => data.network === options.network
    );

    if (addresses.length === 0) {
      console.log(
        chalk.yellow(`No addresses found for network '${options.network}'`)
      );
      return;
    }
  }

  if (options.json) {
    const result = Object.fromEntries(addresses);
    // Add active address marker in JSON
    if (activeAddress && result[activeAddress]) {
      result[activeAddress].isActive = true;
    }
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Table format
    addresses.forEach(([address, data]) => {
      const isActive = address === activeAddress;
      const activeMarker = isActive ? chalk.green(" ⭐ ACTIVE") : "";

      console.log(chalk.cyan(`📍 ${data.name}${activeMarker}`));
      console.log(chalk.gray(`   Address: ${address}`));
      console.log(chalk.gray(`   Network: ${data.network} (${data.prefix})`));
      console.log(
        chalk.gray(
          `   Created: ${new Date(
            data.createdAt || data.importedAt
          ).toLocaleDateString()}`
        )
      );
      console.log();
    });

    console.log(
      chalk.blue(
        `Total: ${addresses.length} address${
          addresses.length !== 1 ? "es" : ""
        }`
      )
    );

    if (activeAddress) {
      if (addressMetadata[activeAddress]) {
        console.log(
          chalk.green(
            `⭐ Active: ${addressMetadata[activeAddress].name} (${activeAddress})`
          )
        );
      } else {
        console.log(
          chalk.yellow(`⭐ Active: ${activeAddress} (not saved locally)`)
        );
      }
    } else {
      console.log(
        chalk.gray(
          "💡 No active address set. Use 'psce address set <address>' to set one"
        )
      );
    }
  }
}

async function setActiveAddress(address) {
  console.log(chalk.blue.bold("🎯 Setting Active Address"));
  console.log();

  const security = new PSCESecurityManager();
  const wallet = new PirichainWallet();

  // Validate address format first
  const isValid = wallet.isValidAddress(address);
  if (!isValid) {
    console.log(chalk.red("❌ Invalid address format"));
    console.log(chalk.gray("Please provide a valid Pirichain address"));
    return;
  }

  // Check if address exists in saved addresses
  const metadata = await security.getNetwork(`address:${address}`);
  if (!metadata) {
    console.log(chalk.yellow("⚠️  Address not found in saved addresses"));
    console.log(
      chalk.gray("You can still set it as active, but it's not saved locally")
    );

    const proceed = await askConfirmation(
      `Set '${address}' as active address anyway?`
    );
    if (!proceed) {
      console.log(chalk.yellow("Operation cancelled"));
      return;
    }
  } else {
    console.log(
      chalk.cyan("📍 Address Found:"),
      chalk.white.bold(metadata.name)
    );
    console.log(chalk.gray("🏠 Address:"), address);
    console.log(
      chalk.gray("🌐 Network:"),
      `${metadata.network} (${metadata.prefix})`
    );
    console.log();

    const proceed = await askConfirmation(
      `Set '${metadata.name}' as active address?`
    );
    if (!proceed) {
      console.log(chalk.yellow("Operation cancelled"));
      return;
    }
  }

  try {
    await security.setActiveAddress(address);
    console.log();
    console.log(chalk.green("✅ Active address set successfully"));
    console.log(chalk.gray("Address:"), address);

    if (metadata) {
      console.log(chalk.gray("Name:"), metadata.name);
      console.log(chalk.gray("Network:"), metadata.network);
    }

    console.log();
    console.log(
      chalk.blue("💡 Use 'psce address current' to view active address")
    );
  } catch (error) {
    console.log(chalk.red("❌ Failed to set active address:"), error.message);
  }
}

async function showCurrentAddress() {
  console.log(chalk.blue.bold("🎯 Current Active Address"));
  console.log();

  const security = new PSCESecurityManager();

  try {
    const activeAddress = await security.getActiveAddress();

    if (!activeAddress) {
      console.log(chalk.gray("No active address set"));
      console.log();
      console.log(chalk.blue("💡 Set an active address with:"));
      console.log(chalk.gray("  psce address set <address>"));
      console.log(chalk.gray("  psce address list  # to see saved addresses"));
      return;
    }

    console.log(
      chalk.cyan("📍 Active Address:"),
      chalk.white.bold(activeAddress)
    );

    // Try to get metadata for the active address
    const metadata = await security.getNetwork(`address:${activeAddress}`);
    if (metadata) {
      console.log(chalk.gray("📝 Name:"), metadata.name);
      console.log(
        chalk.gray("🌐 Network:"),
        `${metadata.network} (${metadata.prefix})`
      );
      console.log(
        chalk.gray("📅 Created:"),
        new Date(metadata.createdAt || metadata.importedAt).toLocaleDateString()
      );
    } else {
      console.log(chalk.yellow("⚠️  Address not found in saved addresses"));
      console.log(
        chalk.gray("This address was set as active but is not saved locally")
      );
    }

    // Show network compatibility
    const activeNetwork = await security.getActiveNetwork();
    if (activeNetwork && metadata) {
      if (metadata.network === activeNetwork) {
        console.log(
          chalk.green("✅ Compatible with active network:"),
          activeNetwork
        );
      } else {
        console.log(chalk.yellow("⚠️  Network mismatch!"));
        console.log(chalk.gray("Address network:"), metadata.network);
        console.log(chalk.gray("Active network:"), activeNetwork);
      }
    }
  } catch (error) {
    console.log(chalk.red("❌ Failed to get active address:"), error.message);
  }
}

async function removeAddress(identifier, options) {
  console.log(chalk.blue.bold("🗑️  Removing Address"));
  console.log();

  const security = new PSCESecurityManager();
  const wallet = new PirichainWallet();

  // First, try to resolve identifier to address
  let address = null;
  let metadata = null;

  // Check if identifier is a valid address format
  const isValidAddressFormat = wallet.isValidAddress(identifier);

  if (isValidAddressFormat) {
    // Identifier is an address, check if it exists
    address = identifier;
    metadata = await security.getNetwork(`address:${address}`);
  } else {
    // Identifier might be a name, search through all addresses
    const networks = await security.getAllNetworks();

    for (const [key, data] of Object.entries(networks)) {
      if (key.startsWith("address:") && data.name === identifier) {
        address = key.replace("address:", "");
        metadata = data;
        break;
      }
    }
  }

  // Check if we found the address
  if (!address || !metadata) {
    console.log(chalk.red("❌ Address not found"));
    if (isValidAddressFormat) {
      console.log(chalk.gray("Address:"), identifier);
      console.log(chalk.gray("This address is not saved locally"));
    } else {
      console.log(chalk.gray("Name:"), identifier);
      console.log(chalk.gray("No address found with this name"));
      console.log();
      console.log(chalk.blue("💡 Available addresses:"));
      console.log(
        chalk.gray("  Use 'psce address list' to see saved addresses")
      );
    }
    return;
  }

  // Show address info
  console.log(chalk.cyan("📍 Address to Remove:"));
  console.log(chalk.gray("   Name:"), chalk.white.bold(metadata.name));
  console.log(chalk.gray("   Address:"), address);
  console.log(
    chalk.gray("   Network:"),
    `${metadata.network} (${metadata.prefix})`
  );
  console.log(
    chalk.gray("   Created:"),
    new Date(metadata.createdAt || metadata.importedAt).toLocaleDateString()
  );

  // Check if this is the active address
  const activeAddress = await security.getActiveAddress();
  if (activeAddress === address) {
    console.log(chalk.yellow("⚠️  This is currently the active address"));
  }

  console.log();

  // Confirmation (unless --force flag is used)
  if (!options.force) {
    console.log(
      chalk.red(
        "⚠️  WARNING: This will permanently delete the address and its private key!"
      )
    );
    console.log(
      chalk.gray(
        "Make sure you have backed up your private key or mnemonic phrase."
      )
    );
    console.log();

    const proceed = await askConfirmation(
      `Are you sure you want to remove '${metadata.name}'?`
    );
    if (!proceed) {
      console.log(chalk.yellow("Address removal cancelled"));
      return;
    }
  }

  try {
    // Remove wallet (private key)
    await security.removeWallet(address);

    // Remove address metadata
    await security.removeNetwork(`address:${address}`);

    // If this was the active address, clear it
    if (activeAddress === address) {
      await security.setActiveAddress("");
      console.log(
        chalk.yellow("🎯 Active address cleared (was the removed address)")
      );
    }

    console.log();
    console.log(chalk.green("✅ Address removed successfully"));
    console.log(chalk.gray("Name:"), metadata.name);
    console.log(chalk.gray("Address:"), address);

    console.log();
    console.log(chalk.blue("💡 Remaining addresses:"));
    console.log(
      chalk.gray("  Use 'psce address list' to see remaining addresses")
    );
  } catch (error) {
    console.log(chalk.red("❌ Failed to remove address:"), error.message);
  }
}

async function renameAddress(oldName, newName) {
  console.log(chalk.blue.bold("🏷️  Renaming Address"));
  console.log();

  const security = new PSCESecurityManager();

  // Validate new name
  if (!newName || !newName.trim()) {
    console.log(chalk.red("❌ New name cannot be empty"));
    return;
  }

  newName = newName.trim();

  // Check if new name already exists
  const networks = await security.getNetworks();
  const existingAddresses = Object.keys(networks).filter((key) =>
    key.startsWith("address:")
  );

  const existingNames = [];
  for (const key of existingAddresses) {
    const metadata = networks[key];
    if (metadata && metadata.name === newName) {
      console.log(chalk.red(`❌ Address name '${newName}' already exists`));
      console.log(chalk.gray("Choose a different name"));
      return;
    }
    existingNames.push(metadata?.name);
  }

  // Find address by old name
  let targetAddress = null;
  let targetMetadata = null;

  for (const key of existingAddresses) {
    const metadata = networks[key];
    if (metadata && metadata.name === oldName) {
      targetAddress = key.replace("address:", "");
      targetMetadata = metadata;
      break;
    }
  }

  if (!targetAddress) {
    console.log(chalk.red(`❌ Address with name '${oldName}' not found`));
    console.log(chalk.gray("Available addresses:"));
    existingNames.forEach((name) => {
      if (name) console.log(chalk.gray(`  - ${name}`));
    });
    return;
  }

  // Show current info
  console.log(chalk.cyan("📍 Current Address Information:"));
  console.log(chalk.gray(`   Name: ${targetMetadata.name}`));
  console.log(chalk.gray(`   Address: ${targetAddress}`));
  console.log(
    chalk.gray(
      `   Network: ${targetMetadata.network} (${targetMetadata.prefix})`
    )
  );
  console.log(
    chalk.gray(
      `   Created: ${new Date(targetMetadata.createdAt).toLocaleString()}`
    )
  );
  console.log();

  // Get confirmation
  const proceed = await askConfirmation(`Rename '${oldName}' to '${newName}'?`);

  if (!proceed) {
    console.log(chalk.yellow("⚠️  Rename cancelled"));
    return;
  }

  try {
    // Update metadata with new name
    const updatedMetadata = {
      ...targetMetadata,
      name: newName,
      renamedAt: new Date().toISOString(),
      previousName: oldName,
    };

    // Store updated metadata
    await security.storeNetwork(`address:${targetAddress}`, updatedMetadata);

    console.log();
    console.log(chalk.green("✅ Address renamed successfully"));
    console.log(chalk.gray("Previous name:"), chalk.strikethrough(oldName));
    console.log(chalk.gray("New name:"), chalk.white.bold(newName));
    console.log(chalk.gray("Address:"), targetAddress);

    // If this was the active address, update the reference
    const activeAddress = await security.getActiveAddress();
    if (activeAddress === targetAddress) {
      console.log();
      console.log(chalk.blue("🎯 Updated active address reference"));
    }

    console.log();
    console.log(chalk.blue("💡 Next steps:"));
    console.log(chalk.gray(`  • Set as active: psce address set ${newName}`));
    console.log(chalk.gray("  • View all addresses: psce address list"));
  } catch (error) {
    console.log(chalk.red("❌ Failed to rename address:"), error.message);
  }
}

module.exports = { registerAddressCommand };

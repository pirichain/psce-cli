const chalk = require("chalk");
const PSCESecurityManager = require("../lib/security-manager");

function registerNetworkCommand(program) {
  const networkCommand = program
    .command("network")
    .alias("n")
    .description("Network management");

  networkCommand
    .command("add")
    .description("Add a new network")
    .option("--name <name>", "Network name/alias")
    .option("--url <url>", "Network URL")
    .action(async (options) => {
      try {
        if (!options.name || !options.url) {
          console.log(chalk.red("❌ Both --name and --url are required"));
          console.log(
            chalk.gray(
              "Usage: psce network add --name mainnet --url https://core.pirichain.com"
            )
          );
          return;
        }

        console.log(chalk.blue.bold("🌐 Adding Network"));
        console.log(chalk.gray(`Name: ${options.name}`));
        console.log(chalk.gray(`URL: ${options.url}`));
        console.log();

        await addNetwork(options.name, options.url);
      } catch (error) {
        console.error(chalk.red("Network add failed:"), error.message);
        process.exit(1);
      }
    });

  networkCommand
    .command("list")
    .description("List available networks")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      try {
        await listNetworks(options);
      } catch (error) {
        console.error(chalk.red("Network list failed:"), error.message);
        process.exit(1);
      }
    });

  networkCommand
    .command("set <name>")
    .description("Set active network")
    .action(async (name) => {
      try {
        await setActiveNetwork(name);
      } catch (error) {
        console.error(chalk.red("Network set failed:"), error.message);
        process.exit(1);
      }
    });

  networkCommand
    .command("current")
    .description("Show current active network")
    .action(async () => {
      try {
        await showCurrentNetwork();
      } catch (error) {
        console.error(chalk.red("Network current failed:"), error.message);
        process.exit(1);
      }
    });

  networkCommand
    .command("test <name>")
    .description("Test network connection")
    .action(async (name) => {
      try {
        await testNetwork(name);
      } catch (error) {
        console.error(chalk.red("Network test failed:"), error.message);
        process.exit(1);
      }
    });

  networkCommand
    .command("remove <name>")
    .description("Remove a network")
    .action(async (name) => {
      try {
        await removeNetwork(name);
      } catch (error) {
        console.error(chalk.red("Network remove failed:"), error.message);
        process.exit(1);
      }
    });
}

async function addNetwork(name, url) {
  console.log(chalk.yellow("🔍 Testing network connection..."));

  try {
    // Step 1: Test /getStats endpoint
    console.log(chalk.gray("→ Testing /getStats endpoint..."));
    const statsResponse = await fetch(`${url}/getStats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });

    if (!statsResponse.ok) {
      throw new Error(
        `HTTP ${statsResponse.status}: ${statsResponse.statusText}`
      );
    }

    const statsData = await statsResponse.json();

    console.log(chalk.green("✅ Network is reachable"));
    console.log(
      chalk.gray("Stats response:"),
      JSON.stringify(statsData, null, 2)
    );

    // Step 2: Get genesis block to determine address prefix
    console.log(chalk.gray("→ Getting genesis block..."));
    const blockResponse = await fetch(`${url}/getBlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blockNumber: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!blockResponse.ok) {
      throw new Error(
        `HTTP ${blockResponse.status}: ${blockResponse.statusText}`
      );
    }

    const blockData = await blockResponse.json();

    console.log(chalk.green("✅ Genesis block retrieved"));
    console.log(
      chalk.gray("Block response:"),
      JSON.stringify(blockData, null, 2)
    );

    // Step 3: Extract address prefix from producerAddress
    const producerAddress = blockData?.producerAddress;
    if (!producerAddress || producerAddress.length < 2) {
      throw new Error("Invalid producerAddress in genesis block");
    }

    const prefix = producerAddress.substring(0, 2);
    console.log(chalk.cyan(`🏷️  Network prefix detected: ${prefix}`));

    // Step 4: Store network information
    const networkData = {
      name: name,
      url: url,
      prefix: prefix,
      addedAt: new Date().toISOString(),
      lastTested: new Date().toISOString(),
      stats: statsData,
    };

    const security = new PSCESecurityManager();
    await security.storeNetwork(name, networkData);

    console.log();
    console.log(chalk.green.bold("✅ Network added successfully!"));
    console.log(chalk.gray(`Name: ${name}`));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Prefix: ${prefix}`));
    console.log();
    console.log(
      chalk.blue("💡 Use 'psce network set " + name + "' to make it active")
    );
  } catch (error) {
    console.log();
    console.log(chalk.red("❌ Network connection failed"));

    if (error.name === "AbortError") {
      console.log(
        chalk.red("Connection timeout - network may be slow or unreachable")
      );
    } else if (error.cause?.code === "ECONNREFUSED") {
      console.log(chalk.red("Connection refused - network may be offline"));
    } else if (error.message.includes("HTTP")) {
      console.log(chalk.red(error.message));
    } else {
      console.log(chalk.red("Error:"), error.message);
    }

    throw error;
  }
}

async function listNetworks(options = {}) {
  const security = new PSCESecurityManager();
  const allData = await security.getAllNetworks();
  const activeNetwork = await security.getActiveNetwork();

  // Filter out address entries - only keep actual networks
  const networks = {};
  Object.entries(allData).forEach(([key, data]) => {
    if (!key.startsWith("address:")) {
      networks[key] = data;
    }
  });

  if (Object.keys(networks).length === 0) {
    if (options.json) {
      console.log(JSON.stringify({}, null, 2));
    } else {
      console.log(chalk.blue.bold("🌐 Available Networks"));
      console.log();
      console.log(chalk.gray("No networks configured."));
      console.log(
        chalk.gray(
          "Add a network with: psce network add --name <name> --url <url>"
        )
      );
    }
    return;
  }

  if (options.json) {
    const result = {};
    Object.entries(networks).forEach(([name, data]) => {
      result[name] = {
        ...data,
        isActive: name === activeNetwork,
      };
    });
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.blue.bold("🌐 Available Networks"));
    console.log();

    Object.entries(networks).forEach(([name, data]) => {
      const isActive = name === activeNetwork;
      const statusIcon = isActive ? chalk.green("●") : chalk.gray("○");
      const nameColor = isActive ? chalk.green.bold : chalk.white;

      console.log(`${statusIcon} ${nameColor(name)}`);
      console.log(chalk.gray(`   URL: ${data.url}`));
      console.log(chalk.gray(`   Prefix: ${data.prefix}`));
      console.log(
        chalk.gray(`   Added: ${new Date(data.addedAt).toLocaleDateString()}`)
      );
      console.log();
    });
  }
}

async function setActiveNetwork(name) {
  const security = new PSCESecurityManager();
  const networks = await security.getAllNetworks();

  if (!networks[name]) {
    console.log(chalk.red(`❌ Network '${name}' not found`));
    console.log(chalk.gray("Available networks:"));
    Object.keys(networks).forEach((netName) => {
      console.log(chalk.gray(`  - ${netName}`));
    });
    return;
  }

  await security.setActiveNetwork(name);

  console.log(chalk.green.bold("✅ Active network set"));
  console.log(chalk.gray(`Active: ${name} (${networks[name].prefix})`));
  console.log(chalk.gray(`URL: ${networks[name].url}`));
}

async function showCurrentNetwork() {
  const security = new PSCESecurityManager();
  const activeNetwork = await security.getActiveNetwork();

  if (!activeNetwork) {
    console.log(chalk.yellow("⚠️  No active network set"));
    console.log(
      chalk.gray("Set an active network with: psce network set <name>")
    );
    return;
  }

  const networks = await security.getAllNetworks();
  const networkData = networks[activeNetwork];

  console.log(chalk.blue.bold("🌐 Current Active Network"));
  console.log();
  console.log(chalk.green(`Name: ${activeNetwork}`));
  console.log(chalk.gray(`URL: ${networkData.url}`));
  console.log(chalk.gray(`Prefix: ${networkData.prefix}`));
  console.log(
    chalk.gray(
      `Last tested: ${new Date(networkData.lastTested).toLocaleString()}`
    )
  );
}

async function testNetwork(name) {
  const security = new PSCESecurityManager();
  const networks = await security.getAllNetworks();

  if (!networks[name]) {
    console.log(chalk.red(`❌ Network '${name}' not found`));
    return;
  }

  const networkData = networks[name];
  console.log(chalk.blue.bold(`🧪 Testing Network: ${name}`));
  console.log(chalk.gray(`URL: ${networkData.url}`));
  console.log();

  try {
    console.log(chalk.yellow("🔍 Testing connection..."));

    const statsResponse = await fetch(`${networkData.url}/getStats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    });

    if (!statsResponse.ok) {
      throw new Error(
        `HTTP ${statsResponse.status}: ${statsResponse.statusText}`
      );
    }

    const statsData = await statsResponse.json();

    console.log(chalk.green("✅ Network is reachable"));
    console.log(
      chalk.gray("Current stats:"),
      JSON.stringify(statsData, null, 2)
    );

    // Update last tested time
    networkData.lastTested = new Date().toISOString();
    networkData.stats = statsData;
    await security.storeNetwork(name, networkData);
  } catch (error) {
    console.log(chalk.red("❌ Network test failed"));
    console.log(chalk.red("Error:"), error.message);
  }
}

async function removeNetwork(name) {
  const security = new PSCESecurityManager();
  const networks = await security.getAllNetworks();

  if (!networks[name]) {
    console.log(chalk.red(`❌ Network '${name}' not found`));
    return;
  }

  const activeNetwork = await security.getActiveNetwork();
  if (activeNetwork === name) {
    console.log(chalk.yellow("⚠️  Cannot remove active network"));
    console.log(chalk.gray("Set a different active network first"));
    return;
  }

  await security.removeNetwork(name);
  console.log(chalk.green(`✅ Network '${name}' removed`));
}

module.exports = { registerNetworkCommand };

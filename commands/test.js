const { Command } = require("commander");
const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

// Main test command
function registerTestCommand(program) {
  const testCommand = program
    .command("test")
    .description("Test PSCE scenarios on blockchain networks")
    .argument("<scenario>", "Scenario name to test")
    .requiredOption("-m, --method <method>", "Method name to execute")
    .option("-p, --params <params>", "Method parameters (comma-separated)")
    .option(
      "-n, --network <network>",
      "Network name (uses current if not specified)"
    )
    .option(
      "-a, --address <address>",
      "Address name (uses current if not specified)"
    )
    .action(async (scenarioName, options) => {
      console.log(chalk.blue("🧪 PSCE Test Runner"));
      console.log();

      // Validate workspace
      const validation = await validateWorkspace();
      if (!validation) return;

      const { configPath, packageJson } = validation;

      // Get scenario file
      const scenarioFile = await getScenarioPath(scenarioName, packageJson);
      if (!scenarioFile) return;

      // Read scenario content
      const scenarioContent = await getScenarioContent(scenarioFile);
      if (!scenarioContent) return;

      // Determine network
      let networkUrl;
      if (options.network) {
        networkUrl = await getNetworkUrl(options.network, configPath);
      } else {
        const currentNetwork = await getCurrentNetwork(configPath);
        if (!currentNetwork) {
          console.log(chalk.red("❌ No current network set"));
          console.log(
            chalk.gray("Set a network with: psce network set <network-name>")
          );
          console.log(
            chalk.gray("Or specify network with: --network <network-name>")
          );
          return;
        }
        networkUrl = await getNetworkUrl(currentNetwork, configPath);
      }

      if (!networkUrl) return;

      // Get address
      const address = await getAddress(options.address, configPath);
      if (!address) {
        console.log(chalk.red("❌ No address available for testing"));
        console.log(
          chalk.gray("Generate an address with: psce address generate")
        );
        console.log(
          chalk.gray("Or specify address with: --address <address-name>")
        );
        return;
      }

      // Parse parameters
      const params = parseParams(options.params);

      // Execute test
      await executeTest(
        networkUrl,
        scenarioContent,
        address,
        options.method,
        params
      );
    });
}

// Workspace validation function
async function validateWorkspace() {
  const packagePath = path.join(process.cwd(), "package.json");

  if (!(await fs.pathExists(packagePath))) {
    console.log(chalk.red("❌ Not a PSCE workspace"));
    console.log(chalk.gray("Run 'psce new <workspace-name>' to create one"));
    return false;
  }

  const packageJson = await fs.readJson(packagePath);
  let configPath;

  // Scenario 1: PSCE workspace (type: "psce")
  if (packageJson.type === "psce") {
    configPath = path.join(process.cwd(), "psce.json");
  }
  // Scenario 2: External directory with PSCE config
  else if (packageJson.psce && packageJson.psce.configFile) {
    const workspaceDir = packageJson.psce.workspaceDir || "./psce-workspace";
    configPath = path.join(workspaceDir, packageJson.psce.configFile);
  } else {
    console.log(chalk.red("❌ Not a PSCE workspace"));
    console.log(chalk.gray("Current directory is not a PSCE workspace"));
    return false;
  }

  if (!(await fs.pathExists(configPath))) {
    console.log(chalk.red("❌ psce.json configuration file not found"));
    console.log(chalk.gray(`Expected file: ${configPath}`));
    console.log(
      chalk.gray("Recreate workspace with: psce new <workspace-name>")
    );
    return false;
  }

  return { configPath, packageJson };
}

// Get scenario file path
async function getScenarioPath(scenarioName, packageJson) {
  let scenariosDir;

  if (packageJson.type === "psce") {
    scenariosDir = path.join(process.cwd(), "scenarios");
  } else {
    const workspaceDir = packageJson.psce.workspaceDir || "./psce-workspace";
    scenariosDir = path.join(workspaceDir, "scenarios");
  }

  const scenarioDir = path.join(scenariosDir, scenarioName);
  const scenarioFile = path.join(scenarioDir, `${scenarioName}.psce`);

  if (!(await fs.pathExists(scenarioFile))) {
    console.log(chalk.red(`❌ Scenario '${scenarioName}' not found`));
    console.log(chalk.gray(`Expected file: ${scenarioFile}`));
    console.log(chalk.gray(`Available scenarios in: ${scenariosDir}`));
    return null;
  }

  return scenarioFile;
}

// Read scenario content
async function getScenarioContent(scenarioFile) {
  try {
    const content = await fs.readFile(scenarioFile, "utf8");
    return content;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to read scenario file: ${error.message}`));
    return null;
  }
}

// Get current network
async function getCurrentNetwork(configPath) {
  try {
    const config = await fs.readJson(configPath);
    return config.currentNetwork || null;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to read config: ${error.message}`));
    return null;
  }
}

// Get network URL
async function getNetworkUrl(networkName, configPath) {
  try {
    const config = await fs.readJson(configPath);
    const networks = config.networks || [];
    const network = networks.find((n) => n.name === networkName);

    if (!network) {
      console.log(chalk.red(`❌ Network '${networkName}' not found`));
      console.log(chalk.gray("Available networks:"));
      networks.forEach((n) =>
        console.log(chalk.gray(`  - ${n.name}: ${n.url}`))
      );
      return null;
    }

    return network.url;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to read networks: ${error.message}`));
    return null;
  }
}

// Get current or specified address
async function getAddress(addressName, configPath) {
  try {
    const config = await fs.readJson(configPath);

    if (!addressName) {
      // Use current address
      return config.currentAddress || null;
    }

    // Find specified address
    const addresses = config.addresses || [];
    const address = addresses.find((a) => a.name === addressName);

    if (!address) {
      console.log(chalk.red(`❌ Address '${addressName}' not found`));
      console.log(chalk.gray("Available addresses:"));
      addresses.forEach((a) =>
        console.log(chalk.gray(`  - ${a.name}: ${a.address}`))
      );
      return null;
    }

    return address;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to read addresses: ${error.message}`));
    return null;
  }
}

// Execute test on network
async function executeTest(
  networkUrl,
  scenarioContent,
  address,
  method,
  params
) {
  try {
    console.log(
      chalk.blue(`🧪 Testing scenario method '${method}' on ${networkUrl}`)
    );
    console.log(chalk.gray(`📍 Using address: ${address.address}`));

    if (params && params.length > 0) {
      console.log(chalk.gray(`📋 Parameters: ${params.join(", ")}`));
    }

    const payload = {
      scenarioText: scenarioContent,
      address: address.address,
      privateKey: address.privateKey,
      method: method,
      params: params || [],
    };

    console.log(chalk.gray("📡 Sending request to network..."));

    const response = await fetch(`${networkUrl}/previewScenario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error === 0) {
      console.log(chalk.green("✅ Test completed successfully"));
      console.log(chalk.yellow("📤 Response:"));
      console.log(JSON.stringify(data.returnedData, null, 2));
    } else {
      console.log(chalk.red(`❌ Test failed with error code: ${data.error}`));
      if (data.returnedData) {
        console.log(chalk.yellow("📤 Error details:"));
        console.log(JSON.stringify(data.returnedData, null, 2));
      }
    }
  } catch (error) {
    console.log(chalk.red(`❌ Network request failed: ${error.message}`));

    if (error.code === "ECONNREFUSED") {
      console.log(chalk.gray("Network might be offline or URL incorrect"));
    } else if (error.code === "ETIMEDOUT") {
      console.log(chalk.gray("Request timed out - network might be slow"));
    } else if (error.message.includes("fetch")) {
      console.log(chalk.gray("Check network URL and connectivity"));
    }
  }
}

// Parse comma-separated parameters
function parseParams(paramsString) {
  if (!paramsString) return [];

  return paramsString.split(",").map((param) => param.trim());
}

module.exports = { registerTestCommand };

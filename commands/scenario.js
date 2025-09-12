const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const { askInput, askConfirmation } = require("../lib/utils");

function registerScenarioCommand(program) {
  const scenarioCommand = program
    .command("scenario")
    .alias("s")
    .description("Scenario management for Pirichain Smart Scenarios");

  scenarioCommand
    .command("add")
    .description("Add a new scenario")
    .option("--name <name>", "Scenario name")
    .option("--network <network>", "Target network")
    .option("--tags <tags>", "Comma-separated tags")
    .action(async (options) => {
      try {
        await addScenario(options);
      } catch (error) {
        console.error(chalk.red("Scenario creation failed:"), error.message);
        process.exit(1);
      }
    });
}

async function addScenario(options) {
  console.log(chalk.blue.bold("🎬 Adding New Scenario"));
  console.log();

  // Check workspace and get configuration
  const workspaceInfo = await getWorkspaceInfo();
  if (!workspaceInfo) return;

  const { workspaceDir, psceConfig } = workspaceInfo;

  // Get scenario name from options or ask user
  let scenarioName = options.name;
  if (!scenarioName) {
    scenarioName = await askInput("Enter scenario name: ", (input) => {
      const trimmed = input.trim();
      if (!trimmed) return "Scenario name is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return "Scenario name can only contain letters, numbers, underscores, and hyphens";
      }
      return true;
    });
  }

  // Validate scenario name
  if (!/^[a-zA-Z0-9_-]+$/.test(scenarioName)) {
    console.log(chalk.red("❌ Invalid scenario name"));
    console.log(
      chalk.gray(
        "Scenario name can only contain letters, numbers, underscores, and hyphens"
      )
    );
    return;
  }

  // Get tags from options or ask user
  let tags = options.tags;
  if (!tags) {
    tags = await askInput(
      "Enter tags (comma-separated, optional): ",
      () => true
    );
  }

  // Parse and validate tags
  const tagList = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag)
    : [];
  const validTags = tagList.filter((tag) => /^[a-zA-Z0-9_-]+$/.test(tag));

  if (tagList.length !== validTags.length) {
    console.log(chalk.yellow("⚠️ Some tags were invalid and will be ignored"));
    console.log(
      chalk.gray(
        "Tags can only contain letters, numbers, underscores, and hyphens"
      )
    );
  }

  // Get network from options or ask user
  let network = options.network;
  if (!network) {
    network = await askInput(
      "Enter target network URL (optional): ",
      () => true
    );
  }

  // Use provided network or default
  const networks =
    network && network.trim() ? [network.trim()] : ["https://chain_network"];

  // Get scenarios directory from config
  const scenariosDir = psceConfig.scenariosDir || "scenarios";
  const scenariosPath = path.join(workspaceDir, scenariosDir);
  const scenarioPath = path.join(scenariosPath, scenarioName);

  // Check if scenario already exists
  if (await fs.pathExists(scenarioPath)) {
    console.log(chalk.red(`❌ Scenario '${scenarioName}' already exists`));
    const overwrite = await askConfirmation("Overwrite existing scenario?");
    if (!overwrite) {
      console.log(chalk.yellow("⚠️ Scenario creation cancelled"));
      return;
    }
    await fs.remove(scenarioPath);
  }

  console.log(chalk.yellow(`📁 Creating scenario '${scenarioName}'...`));

  try {
    // Create scenario directory
    await fs.ensureDir(scenarioPath);

    // Create main .psce file
    await createScenarioFile(scenarioPath, scenarioName);

    // Create scenario config
    await createScenarioConfig(scenarioPath, scenarioName, validTags, networks);

    // Create scenario README
    await createScenarioReadme(scenarioPath, scenarioName, validTags, networks);

    // Create tests structure inside scenario
    await createScenarioTestsStructure(scenarioPath, scenarioName);

    console.log(chalk.green("✅ Scenario created successfully!"));
    console.log();
    console.log(chalk.cyan("📁 Created structure:"));
    console.log(chalk.gray(`   ${scenarioPath}/`));
    console.log(chalk.gray(`   ├── ${scenarioName}.psce`));
    console.log(chalk.gray(`   ├── tests/`));
    console.log(chalk.gray(`   │   ├── ${scenarioName}.test.js`));
    console.log(chalk.gray(`   │   └── README.md`));
    console.log(chalk.gray(`   ├── .scenario-config.json`));
    console.log(chalk.gray(`   └── README.md`));
    console.log();
    console.log(chalk.blue("💡 Next steps:"));
    console.log(chalk.gray(`   Edit ${scenarioPath}/${scenarioName}.psce`));
    console.log(chalk.gray(`   psce test ${scenarioName}`));
  } catch (error) {
    console.log(chalk.red("❌ Failed to create scenario:"), error.message);

    // Cleanup on failure
    try {
      if (await fs.pathExists(scenarioPath)) {
        await fs.remove(scenarioPath);
        console.log(chalk.gray("🧹 Cleaned up partial scenario directory"));
      }
    } catch (cleanupError) {
      console.log(chalk.yellow("⚠️ Failed to cleanup:"), cleanupError.message);
    }
  }
}

async function getWorkspaceInfo() {
  // Check if we're in a PSCE workspace environment
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    console.log(chalk.red("❌ package.json file not found"));
    console.log(
      chalk.gray("Create a workspace first with: psce new <workspace-name>")
    );
    return null;
  }

  let packageJson;
  try {
    packageJson = await fs.readJson(packageJsonPath);
  } catch (error) {
    console.log(chalk.red("❌ Failed to read package.json"));
    console.log(chalk.gray("Error:"), error.message);
    return null;
  }

  let workspaceDir;
  let configPath;

  // Scenario 1: Parent package.json with psce config pointing to workspace
  if (packageJson.psce && packageJson.psce.workspaceDir) {
    workspaceDir = path.resolve(process.cwd(), packageJson.psce.workspaceDir);
    const configFile = packageJson.psce.configFile || "psce.json";
    configPath = path.join(workspaceDir, configFile);

    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.red("❌ PSCE workspace configuration not found"));
      console.log(chalk.gray(`Expected config file: ${configPath}`));
      console.log(
        chalk.gray(
          "If you have a PSCE system, ensure the workspace directory and"
        )
      );
      console.log(
        chalk.gray(
          "configuration files exist, or delete them and recreate with:"
        )
      );
      console.log(chalk.gray("psce new <workspace-name>"));
      return null;
    }
  }
  // Scenario 2: PSCE workspace package.json (type: "psce")
  else if (packageJson.type === "psce") {
    workspaceDir = process.cwd();
    configPath = path.join(workspaceDir, "psce.json");

    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.red("❌ psce.json configuration file not found"));
      console.log(chalk.gray(`Expected file: ${configPath}`));
      console.log(
        chalk.gray("Recreate workspace with: psce new <workspace-name>")
      );
      return null;
    }
  }
  // Neither scenario matches
  else {
    console.log(
      chalk.red("❌ package.json found but no PSCE configuration detected")
    );
    console.log(chalk.gray("Expected either:"));
    console.log(
      chalk.gray("  1. 'psce.workspaceDir' property (parent project)")
    );
    console.log(chalk.gray('  2. "type": "psce" property (PSCE workspace)'));
    console.log(
      chalk.gray("Create a workspace with: psce new <workspace-name>")
    );
    return null;
  }

  // Read psce.json configuration
  let psceConfig;
  try {
    psceConfig = await fs.readJson(configPath);
  } catch (error) {
    console.log(chalk.red("❌ Failed to read psce.json"));
    console.log(chalk.gray("Error:"), error.message);
    return null;
  }

  // Check for scenarios directory
  const scenariosDir = psceConfig.scenariosDir || "scenarios";
  const scenariosPath = path.join(workspaceDir, scenariosDir);
  if (!(await fs.pathExists(scenariosPath))) {
    console.log(chalk.red("❌ Scenarios directory not found"));
    console.log(chalk.gray(`Expected directory: ${scenariosPath}`));
    console.log(
      chalk.gray("Recreate workspace with: psce new <workspace-name>")
    );
    return null;
  }

  return { workspaceDir, psceConfig };
}

async function createScenarioFile(scenarioPath, scenarioName) {
  const psceContent = `/**
 * ${scenarioName} scenario
 * @param address owner address of scenario to initialize
 */
async function init(address) {
    if (address !== OWNER_ADDRESS)
        return {error: 1, message: "This is not owner address!"}

    // Your logic here
    
    return {error: 0, data: "return value"};
}`;

  await fs.writeFile(
    path.join(scenarioPath, `${scenarioName}.psce`),
    psceContent
  );
}

async function createScenarioConfig(
  scenarioPath,
  scenarioName,
  tags = [],
  networks = ["https://chain_network"]
) {
  const scenarioConfig = {
    name: scenarioName,
    description: `PSCE scenario: ${scenarioName}`,
    version: "1.0.0",
    author: "",
    networks: networks,
    dependencies: [],
    testDir: "tests",
    tags: tags,
    methods: [
      {
        method: "init",
        description: "Initialize the scenario",
      },
    ],
  };

  await fs.writeJson(
    path.join(scenarioPath, ".scenario-config.json"),
    scenarioConfig,
    { spaces: 2 }
  );
}

async function createScenarioReadme(
  scenarioPath,
  scenarioName,
  tags = [],
  networks = ["https://chain_network"]
) {
  const scenarioReadme = `# ${scenarioName}

PSCE scenario for blockchain development.

## Description
${scenarioName} scenario implementation.
${
  tags.length > 0
    ? `\n## Tags\n${tags.map((tag) => `- ${tag}`).join("\n")}\n`
    : ""
}
## Usage
\`\`\`bash
psce test ${scenarioName}
\`\`\`

## Methods
- **init**: Initialize the scenario

## Networks
${networks.map((network) => `- ${network}`).join("\n")}
`;

  await fs.writeFile(path.join(scenarioPath, "README.md"), scenarioReadme);
}

async function createScenarioTestsStructure(scenarioPath, scenarioName) {
  const testsPath = path.join(scenarioPath, "tests");
  await fs.ensureDir(testsPath);

  // Create basic test file
  const testContent = `// PSCE Test File
// Run with: psce test ${scenarioName}

const fs = require('fs');
const path = require('path');

const test = {
  scenario: "${scenarioName}",
  method: "init",
  params: ["<address>"], // Example address parameter
  description: "Test ${scenarioName} scenario init method",
  
  async run() {
    try {
      // Get active network from PSCE configuration
      const activeNetwork = await this.getActiveNetwork();
      
      // Get active address and private key
      const { address, privateKey } = await this.getActiveAddress();
      
      // Read scenario file from same directory level
      const scenarioPath = path.join(__dirname, '../${scenarioName}.psce');
      const scenarioText = fs.readFileSync(scenarioPath, 'utf8');
      
      // Prepare test request
      const testRequest = {
        scenarioText: scenarioText,
        address: address,
        privateKey: privateKey,
        method: this.method,
        params: this.params
      };
      
      // Send POST request to /previewScenario endpoint
      const response = await fetch(\`\${activeNetwork}/previewScenario\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRequest)
      });
      
      // Parse response
      const responseData = await response.json();
      const { error, returnedData } = responseData;
      
      if (error === 0) {
        console.log("✅ Test passed successfully");
        console.log("Returned data:", returnedData);
        return { success: true, data: returnedData };
      } else {
        console.log("❌ Test failed with error:", error);
        return { success: false, error: error, data: returnedData };
      }
      
    } catch (err) {
      console.log("❌ Test execution failed:", err.message);
      return { success: false, error: -1, message: err.message };
    }
  },
  
  async getActiveNetwork() {
    try {
      // Use psce network current command to get active network
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('psce network current');
      
      // Parse output to extract URL
      const urlMatch = stdout.match(/URL:\s*(.+)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1].trim();
      }
      
      // Fallback to default
      console.log("Warning: Could not get active network, using default");
      return "https://testnet.pirichain.com";
      
    } catch (error) {
      console.log("Warning: Failed to get active network, using default");
      return "https://testnet.pirichain.com";
    }
  },
  
  async getActiveAddress() {
    // TODO: Implement active address/private key retrieval
    // May require master password for private key access
    return {
      address: "<address>",
      privateKey: "<your-private-key-here>"
    };
  }
};

module.exports = test;
`;
  await fs.writeFile(
    path.join(testsPath, `${scenarioName}.test.js`),
    testContent
  );

  // Create test README
  const testReadme = `# PSCE Tests

This directory contains test files for the ${scenarioName} scenario.

## How PSCE Testing Works

PSCE tests work by sending requests to the active network's \`/previewScenario\` endpoint with:

- **scenarioText**: The complete scenario code
- **address**: Active selected address
- **privateKey**: Private key of the active address (master password may be required)
- **method**: Name of the method to execute
- **params**: Array of parameter values for the method

## Test Response

The network returns: \`{error: number, returnedData: any}\`

- **error: 0** = Success
- **error: > 0** = Error occurred

## Running Tests

\`\`\`bash
psce test ${scenarioName}
\`\`\`

## Test File Structure

Each test file should export an object with:
- \`scenario\`: Name of the scenario to test
- \`method\`: Method name to execute
- \`params\`: Array of parameter values
- \`description\`: Test description
- \`run()\`: Async function that executes the test
- \`getActiveNetwork()\`: Uses \`psce network current\` to get active network URL
- \`getActiveAddress()\`: Returns active address and private key

## Network Detection

The \`getActiveNetwork()\` function automatically detects the active network by:
1. Running \`psce network current\` command
2. Parsing the output to extract URL from "URL: <address>" format
3. Using the extracted URL for test requests
4. Falling back to default testnet if detection fails

## Security Notes

- Private keys are accessed securely through PSCE's address management
- Master password may be required for private key access during testing
- Tests use the preview endpoint, no actual blockchain transactions occur
- Active network is dynamically retrieved from PSCE configuration
`;
  await fs.writeFile(path.join(testsPath, "README.md"), testReadme);
}

// Export the scenario creation functions for reuse
async function createScenario(
  scenarioPath,
  scenarioName,
  tags = [],
  networks = ["https://chain_network"]
) {
  await fs.ensureDir(scenarioPath);
  await createScenarioFile(scenarioPath, scenarioName);
  await createScenarioConfig(scenarioPath, scenarioName, tags, networks);
  await createScenarioReadme(scenarioPath, scenarioName, tags, networks);
  await createScenarioTestsStructure(scenarioPath, scenarioName);
}

module.exports = {
  registerScenarioCommand,
  createScenario,
  createScenarioFile,
  createScenarioConfig,
  createScenarioReadme,
  createScenarioTestsStructure,
};

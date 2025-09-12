const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const { askInput, askConfirmation } = require("../lib/utils");
const { createScenario } = require("./scenario");

function registerNewCommand(program) {
  program
    .command("new")
    .description("Create a new PSCE workspace")
    .argument("[project-name]", "name of the PSCE workspace to create")
    .action(async (projectName) => {
      try {
        await createPsceWorkspace(projectName);
      } catch (error) {
        console.error(chalk.red("Error:"), error.message);
        process.exit(1);
      }
    });
}

async function createPsceWorkspace(projectName) {
  console.log(
    chalk.blue.bold("🔗 Welcome to PSCE - Pirichain Smart Scenarios")
  );
  console.log(chalk.gray("Creating your blockchain development workspace..."));
  console.log();

  // Get project name if not provided
  if (!projectName) {
    projectName = await askInput(
      "What is the name of your PSCE workspace?",
      (input) => {
        if (!input.trim()) {
          return "Workspace name is required";
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
          return "Workspace name should only contain letters, numbers, hyphens, and underscores";
        }
        return true;
      }
    );
  }

  // Create project directory
  const projectPath = path.join(process.cwd(), projectName);

  if (await fs.pathExists(projectPath)) {
    console.error(
      chalk.red(`Error: Directory "${projectName}" already exists`)
    );
    process.exit(1);
  }

  console.log(chalk.green(`Creating PSCE workspace "${projectName}"...`));

  await fs.ensureDir(projectPath);
  await generatePsceWorkspace(projectPath, projectName);

  console.log();
  console.log(chalk.green.bold("✅ PSCE Workspace created successfully!"));
  console.log();
  console.log(chalk.yellow("Next steps:"));
  console.log(chalk.gray(`  cd ${projectName}`));
  console.log(
    chalk.gray("  code .  # Open in VS Code (PSCE extension will auto-detect)")
  );
  console.log();
  console.log(chalk.blue("Available PSCE commands:"));
  console.log(chalk.gray("  psce scenario add <name>"));
  console.log(chalk.gray("  psce test <scenario-name>"));
  console.log(
    chalk.gray("  psce deploy <scenario-name> --network=<testnet|mainnet>")
  );
}

async function generatePsceWorkspace(projectPath, projectName) {
  // Update or create package.json in current directory (parent)
  await updateParentPackageJson(projectName);

  // Create psce.json in workspace directory
  await createPsceConfig(projectPath);

  // Create psce-workspace structure
  await createWorkspaceStructure(projectPath);

  // Create README.md in workspace directory
  await createReadme(projectPath, projectName);

  // Create .gitignore in workspace directory
  await createGitignore(projectPath);
}

async function updateParentPackageJson(projectName) {
  const parentPath = process.cwd();
  const packageJsonPath = path.join(parentPath, "package.json");

  let packageJson = {};

  // Read existing package.json if it exists
  if (await fs.pathExists(packageJsonPath)) {
    try {
      packageJson = await fs.readJson(packageJsonPath);
      console.log(
        chalk.gray(
          "Found existing package.json, updating with PSCE configuration..."
        )
      );
    } catch (error) {
      console.log(
        chalk.yellow(
          "Warning: Could not read existing package.json, creating new one"
        )
      );
    }
  } else {
    console.log(
      chalk.gray("Creating new package.json with PSCE configuration...")
    );
    // Create basic package.json structure
    packageJson = {
      type: "psce",
      name: path.basename(parentPath),
      version: "1.0.0",
      description: "Project with PSCE workspace",
      main: "index.js",
      scripts: {},
      devDependencies: {},
      dependencies: {},
    };
  }

  // Add or update PSCE configuration
  packageJson.psce = {
    workspaceDir: `./${projectName}`,
    configFile: "psce.json",
    autoWatch: true,
  };

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

async function createPsceConfig(projectPath) {
  const psceConfig = {
    version: "1.0",
    scenariosDir: "scenarios",
    params: {
      fersah: 0.0005,
    },
  };

  await fs.writeJson(path.join(projectPath, "psce.json"), psceConfig, {
    spaces: 2,
  });
}

async function createWorkspaceStructure(projectPath) {
  // Create main directories
  await fs.ensureDir(path.join(projectPath, "scenarios"));

  // Create basic example scenario using shared function with default tags
  const examplePath = path.join(projectPath, "scenarios", "example");
  await createScenario(examplePath, "example", ["example", "starter"]);
}

async function createReadme(projectPath, projectName) {
  const readmeContent = `# ${projectName}

PSCE (Pirichain Smart Scenarios) Workspace

## Overview

This is a PSCE workspace created for blockchain development on the Pirichain network.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PSCE CLI installed globally

### Development
\`\`\`bash
# Add a new scenario
psce scenario add my-scenario
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── scenarios/              # PSCE scenario files
│   └── example/            # Example scenario
│       ├── example.psce    # Scenario code
│       ├── tests/          # Scenario tests
│       ├── .scenario-config.json
│       └── README.md
├── psce.json              # PSCE workspace configuration
├── README.md              # This file
└── .gitignore             # Git ignore rules
\`\`\`

## PSCE Configuration

PSCE settings are configured in \`psce.json\`:

- \`scenariosDir\`: Directory containing scenarios (default: "scenarios")
- \`params\`: Global parameters for scenarios
- \`version\`: PSCE configuration version

## Testing

Tests are automatically executed against the active network using the \`/previewScenario\` endpoint. The test system:

1. Gets the active network via \`psce network current\`
2. Retrieves active address and private key
3. Sends scenario code to the network for testing
4. Returns results without executing actual transactions
`;

  await fs.writeFile(path.join(projectPath, "README.md"), readmeContent);
}

async function createGitignore(projectPath) {
  const gitignoreContent = `# Environment variables
.env
`;

  await fs.writeFile(path.join(projectPath, ".gitignore"), gitignoreContent);
}

module.exports = { registerNewCommand };

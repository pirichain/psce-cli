# PSCE CLI

A command-line interface for **Pirichain Smart Contract Engine (PSCE)**. Create, manage, and test blockchain development workspaces with smart contract scenarios.

## Installation

### Global Installation

```bash
npm install -g psce
```

### Using npx

```bash
npx psce new my-workspace
```

## Quick Start

```bash
# Create a new PSCE workspace
psce new my-workspace
cd my-workspace

# Add a new scenario
psce scenario add payment --tags "finance,payment" --network https://testnet.pirichain.com

# Manage networks
psce network add --name testnet --url https://testnet.pirichain.com
psce network set testnet

# Test your scenario
psce test payment
```

## Commands

### Workspace Management

```bash
# Create new workspace
psce new <workspace-name>
```

### Scenario Management

```bash
# Add new scenario
psce scenario add [options]
  --name <name>       Scenario name
  --tags <tags>       Comma-separated tags
  --network <url>     Target network URL

# Examples
psce scenario add payment
psce scenario add --name nft-market --tags "nft,marketplace" --network https://mainnet.pirichain.com
```

### Network Management

```bash
# Network commands (can use 'n' as shorthand)
psce network|n add --name <name> --url <url>    # Add network
psce network|n list                             # List networks
psce network|n set <name>                       # Set active network
psce network|n current                          # Show current network
psce network|n test <name>                      # Test network connection
psce network|n remove <name>                    # Remove network

# Examples
psce n add --name mainnet --url https://mainnet.pirichain.com
psce n set mainnet
psce n current
```

## Generated Workspace Structure

```
my-workspace/
├── package.json              # PSCE configuration
├── scenarios/                # Smart contract scenarios
│   └── example/              # Example scenario
│       ├── example.psce      # Scenario code
│       ├── tests/            # Scenario-specific tests
│       │   ├── example.test.js
│       │   └── README.md
│       ├── .scenario-config.json
│       └── README.md
├── psce.json                 # PSCE workspace configuration
├── README.md                 # Workspace documentation
└── .gitignore
```

## Scenario Configuration

Each scenario includes:

```json
{
  "name": "payment",
  "description": "PSCE scenario: payment",
  "version": "1.0.0",
  "author": "",
  "networks": ["https://testnet.pirichain.com"],
  "dependencies": [],
  "testDir": "tests",
  "tags": ["finance", "payment"],
  "methods": [
    {
      "method": "init",
      "description": "Initialize the scenario"
    }
  ]
}
```

## Testing System

PSCE tests work by sending requests to the active network's `/previewScenario` endpoint:

- **scenarioText**: Complete scenario code
- **address**: Active selected address
- **privateKey**: Private key (master password may be required)
- **method**: Method name to execute
- **params**: Parameter values

Test responses: `{error: number, returnedData: any}`

- **error: 0** = Success
- **error: > 0** = Error occurred

## Features

- 🔗 **Workspace Creation**: Generate complete PSCE development environments
- 📝 **Scenario Management**: Create scenarios with customizable tags and networks
- 🌐 **Network Management**: Add, test, and manage multiple blockchain networks
- 🧪 **Integrated Testing**: Built-in test framework using real PSCE API endpoints
- ⚡ **Dynamic Configuration**: Auto-detects workspace type and structure
- 🎯 **VS Code Ready**: Works with PSCE VS Code extension

## Network Auto-Detection

The CLI automatically detects network properties:

- Tests `/getStats` endpoint for connectivity
- Extracts address prefix from genesis block
- Stores network metadata for future use

## Development

### Local Setup

```bash
git clone <repository-url>
cd psce-cli
npm install
npm link

# Test CLI
psce new test-workspace
```

### Project Structure

```
psce-cli/
├── bin/
│   └── psce.js              # CLI entry point
├── commands/
│   ├── new.js              # Workspace creation
│   ├── scenario.js         # Scenario management
│   └── network.js          # Network management
├── lib/
│   ├── utils.js            # Utility functions
│   └── security-manager.js # Network/security management
└── package.json
```

## Examples

### Create Complete Project

```bash
# Create workspace
psce new my-dapp
cd my-dapp

# Add networks
psce n add --name testnet --url https://testnet.pirichain.com
psce n add --name mainnet --url https://mainnet.pirichain.com
psce n set testnet

# Create scenarios
psce scenario add --name token --tags "token,erc20" --network https://testnet.pirichain.com
psce scenario add --name nft --tags "nft,collectibles" --network https://mainnet.pirichain.com

# Test scenarios
psce test token
psce test nft
```

## Networks

- **Testnet**: https://testnet.pirichain.com
- **Mainnet**: https://mainnet.pirichain.com

# PSCE CLI

A command-line interface for **Pirichain Smart Scenarios (PSCE)**. Create, manage, and test blockchain development workspaces with smart contract scenarios.

[![npm version](https://badge.fury.io/js/psce.svg)](https://badge.fury.io/js/psce)
[![npm downloads](https://img.shields.io/npm/dm/psce.svg)](https://npmjs.org/package/psce)

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

# Add and set network
psce network add --name testnet --url https://testnet.pirichain.com
psce network set testnet

# Generate and set address
psce address generate --save wallet1
psce address set wallet1

# Add a new scenario
psce scenario add payment --tags "finance,payment" --network https://testnet.pirichain.com

# Test your scenario
psce test payment -m init
psce test payment -m transfer -p "100,TZ123abc"
```

## Commands

### Workspace Management

```bash
# Create new workspace
psce new <workspace-name>
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

### Address Management

```bash
# Address commands (can use 'a' as shorthand)
psce address|a generate [--save <name>]         # Generate new address (auto-saves as temp-* or custom name)
psce address|a list                             # List all addresses
psce address|a set <name>                       # Set active address
psce address|a current                          # Show current address
psce address|a rename <oldName> <newName>       # Rename address
psce address|a remove <name>                    # Remove address

# Examples
psce a generate                                 # Auto-saves as temp-1699123456
psce a generate --save wallet1                  # Saves as wallet1
psce a rename temp-1699123456 mainwallet        # Rename temp to permanent name
psce a set mainwallet
psce a current
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

### Testing

```bash
# Test scenario methods
psce test <scenario> -m <method> [options]
  -m, --method <method>    Method name to execute (required)
  -p, --params <params>    Method parameters (comma-separated)
  -n, --network <network>  Network name (uses current if not specified)
  -a, --address <address>  Address name (uses current if not specified)

# Examples
psce test payment -m init
psce test token -m transfer -p "100,TZ123abc"
psce test nft -m mint -n mainnet -a wallet1
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
- 👤 **Address Management**: Generate, manage, and secure blockchain addresses with auto-save functionality
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
│   ├── network.js          # Network management
│   ├── address.js          # Address management
│   └── test.js             # Testing framework
├── lib/
│   ├── utils.js            # Utility functions
│   ├── security-manager.js # Network/security management
│   └── wallet/             # Wallet functionality
│       ├── createNewAddress.js  # Address generation
│       ├── getMnemonic.js       # Mnemonic handling
│       ├── index.js             # Wallet exports
│       ├── isValidAddress.js    # Address validation
│       ├── rescuePrivateKey.js  # Key recovery
│       └── utility.js           # Wallet utilities
└── package.json
```

## Examples

### Create Complete Project

```bash
# Create workspace
psce new my-dapp
cd my-dapp

# Add and set network
psce n add --name PirichainTestnet --url https://testnet.pirichain.com
psce n add --name PirichainMainnet --url https://core.pirichain.com

# You can also add custom or local networks
psce n add --name local --url http://localhost:8080
psce n add --name custom --url https://my-custom-network.com

# Set active network
psce n set PirichainTestnet

# Generate and set active address
psce a generate --save wallet1
psce a set wallet1

# Create scenarios
psce scenario add --name token --tags "token,erc20" --network https://testnet.pirichain.com
psce scenario add --name nft --tags "nft,collectibles" --network https://core.pirichain.com

# Test scenarios
psce test token -m init
psce test token -m transfer -p "100,TZ123abc"
psce test nft -m mint -n mainnet -a wallet1
```

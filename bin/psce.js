#!/usr/bin/env node

const { Command } = require("commander");

// Import command modules
const { registerNewCommand } = require("../commands/new");
const { registerScenarioCommand } = require("../commands/scenario");
const { registerNetworkCommand } = require("../commands/network");
const { registerAddressCommand } = require("../commands/address");

const program = new Command();

program
  .version("1.0.0")
  .description("PSCE - Pirichain Smart Contract Engine CLI");

// Register all commands
registerNewCommand(program);
registerScenarioCommand(program);
registerNetworkCommand(program);
registerAddressCommand(program);

program.parse(process.argv);

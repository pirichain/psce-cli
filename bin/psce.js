#!/usr/bin/env node

const { Command } = require("commander");

// Import command modules
const { registerNewCommand } = require("../commands/new");
const { registerScenarioCommand } = require("../commands/scenario");
const { registerNetworkCommand } = require("../commands/network");
const { registerAddressCommand } = require("../commands/address");
const { registerTestCommand } = require("../commands/test");

const program = new Command();

program.version("1.1.4").description("PSCE - Pirichain Smart Scenarios CLI");

// Register all commands
registerNewCommand(program);
registerScenarioCommand(program);
registerNetworkCommand(program);
registerAddressCommand(program);
registerTestCommand(program);

program.parse(process.argv);

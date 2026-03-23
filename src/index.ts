import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { serveCommand } from "./commands/serve.js";
import { doctorCommand } from "./commands/doctor.js";

declare const __VERSION__: string;

const program = new Command();

program
  .name("achannel")
  .description("The portable channel layer for AI companions")
  .version(__VERSION__)
  .action(() => listCommand());

program
  .command("add <channel>")
  .description("Add a channel (telegram, discord, whatsapp, webhook)")
  .action((channel) => addCommand(channel));

program
  .command("remove <channel>")
  .description("Remove a channel")
  .action((channel) => removeCommand(channel));

program
  .command("list")
  .description("List configured channels")
  .action(() => listCommand());

program
  .command("serve")
  .description("Start all configured channels")
  .action(() => serveCommand());

program
  .command("doctor")
  .description("Health check channel configuration")
  .action(() => doctorCommand());

program.parse();

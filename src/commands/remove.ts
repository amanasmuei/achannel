import * as p from "@clack/prompts";
import pc from "picocolors";
import { removeChannel } from "../lib/config.js";

export async function removeCommand(channelName: string): Promise<void> {
  p.intro(pc.bold("achannel remove"));

  const removed = removeChannel(channelName);
  if (removed) {
    p.log.success(`Removed channel: ${channelName}`);
  } else {
    p.log.error(`Channel not found: ${channelName}`);
  }

  p.outro("Done.");
}

import path from "node:path";
import os from "node:os";

export const HOME = os.homedir();
export const CONFIG_DIR = path.join(HOME, ".achannel");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
export const CHANNELS_PATH = path.join(CONFIG_DIR, "channels.md");

export const ECOSYSTEM_FILES = [
  { path: path.join(HOME, ".acore", "core.md"), name: "identity" },
  { path: path.join(HOME, ".akit", "kit.md"), name: "tools" },
  { path: path.join(HOME, ".aflow", "flow.md"), name: "workflows" },
  { path: path.join(HOME, ".arules", "rules.md"), name: "guardrails" },
  { path: path.join(HOME, ".askill", "skills.md"), name: "skills" },
] as const;

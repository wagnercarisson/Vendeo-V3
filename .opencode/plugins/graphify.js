// graphify OpenCode plugin
// Injects a knowledge graph reminder before bash tool calls when the graph exists.
//
// IMPORTANT: keep the reminder string free of backticks and $(...) constructs.
// The hook prepends `echo "<reminder>" && <cmd>` to the user's bash command;
// backticks inside the double-quoted echo trigger bash command substitution,
// which both corrupts tool output and silently executes the very graphify
// command we are only suggesting. Plain words render fine in opencode's TUI.
import { Plugin } from "@opencode/plugin";
import { existsSync } from "node:fs";
import { join } from "node:path";

export default Plugin.define({
  id: "graphify",
  async setup(ctx) {
    let reminded = false;

    await ctx.tool.hook("execute.before", (event) => {
      if (reminded || event.tool !== "bash") return;

      const directory = ctx.location.directory;
      if (!existsSync(join(directory, "graphify-out", "graph.json"))) return;

      const input = event.input;
      if (typeof input?.command !== "string") return;

      input.command =
        'echo "[graphify] Knowledge graph at graphify-out/. Use graphify query for focused questions. Read GRAPH_REPORT.md for broad architecture context." && ' +
        input.command;

      reminded = true;
    });
  },
});

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const AGENT_DIR = path.resolve(process.env.AGENT_DIR || "C:/Users/tyson/jarvis-device-agent");

export async function GET() {
  if (!existsSync(path.join(AGENT_DIR, "package.json"))) {
    return NextResponse.json({ error: "Agent source not found" }, { status: 404 });
  }

  try {
    // Create tar.gz of the agent source (exclude node_modules, dist, .git, audit logs)
    const tarBuffer = execSync(
      `tar -czf - --exclude=node_modules --exclude=dist --exclude=.git --exclude="*.log" --exclude=device-agent-config.json -C "${path.dirname(AGENT_DIR)}" "${path.basename(AGENT_DIR)}"`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    return new Response(tarBuffer, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": "attachment; filename=jarvis-device-agent.tar.gz",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create bundle: ${msg}` }, { status: 500 });
  }
}

import { execSync } from "child_process";

export interface DeploymentMeta {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildTime: string;
  nodeVersion: string;
  environment: string;
}

let _cached: DeploymentMeta | null = null;

export function getDeploymentMeta(): DeploymentMeta {
  if (_cached) return _cached;

  let gitCommit = "unknown";
  let gitBranch = "unknown";

  try {
    gitCommit = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    // git not available
  }

  try {
    gitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    // git not available
  }

  _cached = {
    version: process.env.npm_package_version ?? "1.0.0",
    gitCommit,
    gitBranch,
    buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? "development",
  };

  return _cached;
}

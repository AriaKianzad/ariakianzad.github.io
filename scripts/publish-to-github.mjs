import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPOSITORY_URL = "https://github.com/AriaKianzad/ariakianzad.github.io.git";
const EXPECTED_BRANCH = "main";
const PROJECT_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}` +
      (details ? `:\n${details}` : ""),
    );
  }
  return result;
}

function git(args, options) {
  return run("git", args, options);
}

function main() {
  const topLevel = realpathSync(git(["rev-parse", "--show-toplevel"]).stdout.trim());
  if (topLevel !== PROJECT_ROOT) {
    throw new Error("The script is not running from the root of this website repository.");
  }

  const branch = git(["branch", "--show-current"]).stdout.trim();
  if (branch !== EXPECTED_BRANCH) {
    throw new Error(
      `Expected branch "${EXPECTED_BRANCH}" but found "${branch || "(detached HEAD)"}". No push was attempted.`,
    );
  }

  const remotes = git(["remote"]).stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (remotes.includes("origin")) {
    const origin = git(["remote", "get-url", "origin"]).stdout.trim();
    if (origin !== REPOSITORY_URL) {
      throw new Error(
        `The existing origin points to "${origin}", not the personal website repository. It was not changed.`,
      );
    }
  } else {
    git(["remote", "add", "origin", REPOSITORY_URL], { inherit: true });
  }

  console.log("Scanning the working tree for accidental credentials...");
  run("npm", ["run", "check:security"], { inherit: true });

  console.log("Staging changes in the personal website repository only...");
  git(["add", "-A"], { inherit: true });

  const diff = git(["diff", "--cached", "--quiet"], { allowFailure: true });
  if (diff.status === 1) {
    git(["commit", "-m", "Prepare personal website for GitHub Pages"], { inherit: true });
  } else if (diff.status !== 0) {
    throw new Error("Could not inspect the Git index (exit code " + diff.status + ").");
  } else {
    console.log("No new local changes to commit.");
  }

  console.log("Pushing main to the personal website repository...");
  git(["push", "--set-upstream", "origin", "main"], { inherit: true });
  console.log("");
  console.log("Push completed. GitHub Actions will build and deploy the site.");
  console.log("Expected URL: https://ariakianzad.github.io/");
}

try {
  main();
} catch (error) {
  console.error("✗ " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

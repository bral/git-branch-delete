#!/usr/bin/env node

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { prompt } from "enquirer";
import colors from "ansi-colors";

const execAsync = promisify(exec);

interface GitBranch {
  name: string;
  lastCommitRelative: string;
  lastCommit: string;
  isCurrent: boolean;
}

interface BranchChoice {
  name: string;
  message: string;
  value: string;
}

const findGitRoot = (): boolean => {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".git"))) return true;
    dir = resolve(dir, "..");
  }
  return false;
};

const getGitBranches = async (): Promise<GitBranch[]> => {
  const cmd = `git branch -v --format="%(if)%(HEAD)%(then)*%(else) %(end)%(refname:short):::%(committerdate:relative):::%(committerdate:iso8601)"`;

  try {
    const { stdout } = await execAsync(cmd);
    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [prefix, ...parts] = line.split(":::");
        const isCurrent = prefix.startsWith("*");
        const name = prefix.replace(/^[\s*]+/, "");
        const [lastCommitRelative = "Unknown", lastCommit = ""] = parts;

        return { name, lastCommitRelative, lastCommit, isCurrent };
      })
      .filter((branch) => branch.name);
  } catch (error) {
    throw new Error(`Failed to get git branches: ${(error as Error).message}`);
  }
};

const selectBranchNames = async (branches: GitBranch[]): Promise<string[]> => {
  const [current, ...others] = branches
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

  if (current?.isCurrent) {
    console.log(
      colors.yellow(
        `Current branch: ${current.name} (${current.lastCommitRelative})`,
      ),
    );
  }

  const choices: BranchChoice[] = others.map(
    ({ name, lastCommitRelative }) => ({
      name,
      message: `${name} (${lastCommitRelative})`,
      value: name,
    }),
  );

  try {
    const { branchNames } = await prompt<{ branchNames: string[] }>({
      type: "multiselect",
      name: "branchNames",
      message: "Select (space) which branches to delete:",
      choices,
    });
    return branchNames;
  } catch {
    console.log(colors.blue("Exiting without deleting any branches."));
    process.exit(0);
  }
};

const confirmDeletion = async (branches: string[]): Promise<boolean> => {
  if (!branches.length) return false;

  console.log(
    colors.red.bold.underline("You have selected these branches to delete:"),
  );
  console.log(branches.map((name, i) => ` ${i + 1}. ${name}`).join("\n"));

  try {
    const { confirmation } = await prompt<{ confirmation: string }>({
      type: "input",
      name: "confirmation",
      message: `Delete these ${branches.length} branches? Type ${colors.green("yes")} or ${colors.green("no")}`,
      validate: (input: string) =>
        /^(yes|no)$/.test(input) || "Please answer 'yes' or 'no'",
    });
    return confirmation === "yes";
  } catch {
    return false;
  }
};

const deleteBranches = async (branches: string[]): Promise<void> => {
  if (!branches.length) return;

  try {
    const { stdout } = await execAsync(
      `git branch -D ${branches.map((b) => `'${b}'`).join(" ")}`,
    );
    console.log(stdout);
    console.log(colors.green("All selected branches deleted."));
  } catch (error) {
    throw new Error(`Failed to delete branches: ${(error as Error).message}`);
  }
};

const main = async (): Promise<void> => {
  try {
    if (!findGitRoot()) {
      console.log(
        colors.blue(
          "Not a Git repository. Please navigate to a directory with a .git folder.",
        ),
      );
      return;
    }

    const branches = await getGitBranches();

    if (branches.length === 1 && branches[0].isCurrent) {
      console.log(
        colors.blue("Only one branch (current) exists. Nothing to do."),
      );
      return;
    }

    const selectedBranches = await selectBranchNames(branches);
    if (!selectedBranches.length) return;

    const confirmed = await confirmDeletion(selectedBranches);
    if (!confirmed) {
      console.log(colors.blue("No branches deleted."));
      return;
    }

    await deleteBranches(selectedBranches);
  } catch (error) {
    console.error(colors.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
};

main();

#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const enquirer = require("enquirer");
const colors = require("ansi-colors");
interface GitBranch {
  name: string;
  lastCommitRelative: string;
  lastCommit: string;
  isCurrent?: boolean;
}

const isGitRepository = (): boolean => {
  let dir = process.cwd();
  for (;;) {
    const gitDir = path.resolve(dir, ".git");
    if (fs.existsSync(gitDir)) {
      return true;
    }
    if (dir === "/") {
      return false;
    }
    dir = path.resolve(dir, "..");
  }
};

const getGitBranches = (): Promise<GitBranch[]> => {
  return new Promise((resolve, reject) => {
    const cmd =
      "git for-each-ref --sort=committerdate refs/heads/ --format='%(HEAD):%(refname:short):::%(committerdate:relative):::%(committerdate:iso8601)'";
    child_process.exec(
      cmd,
      { encoding: "utf-8" },
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
          return;
        }
        const lines: string[] = stdout.split("\n");
        // const linesWithoutCurrentBranch = lines.filter(
        //   (line) => !line.startsWith("*:")
        // );
        const branches: GitBranch[] = lines
          .map((line) => {
            const isCurrent = line.startsWith("*:");
            const [name, lastCommitRelative, lastCommit] = line
              .substring(2)
              .split(":::");
            return {
              name,
              lastCommit,
              lastCommitRelative: lastCommitRelative || "Unknown",
              isCurrent, // Add an isCurrent flag
            };
          })
          .filter((branch) => branch.name !== "");

        resolve(branches);
      }
    );
  });
};

const selectBranchNames = async (branches: GitBranch[]): Promise<string[]> => {
  const sortedBranches: GitBranch[] = branches
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentBranch = sortedBranches.find((branch) => branch.isCurrent);
  const otherBranches = sortedBranches.filter((branch) => !branch.isCurrent);

  if (currentBranch) {
    console.log(
      colors.yellow(
        `Current branch: ${currentBranch.name} (${currentBranch.lastCommitRelative})`
      )
    );
  }

  const choices = otherBranches.map((branch) => {
    return {
      name: branch.name,
      message: `${branch.name} (${branch.lastCommitRelative})`,
      value: branch.name,
    };
  });

  const response = await enquirer
    .prompt({
      type: "multiselect",
      name: "branchNames",
      message: "Select (space) which branches to delete:",
      choices,
    })
    .catch(() => {
      console.log(colors.blue("Exiting without deleting any branches."));
      process.exit(0);
    });

  const selectedBranchNames = response.branchNames;

  return selectedBranchNames;
};

const askForConfirmation = async (
  branchesToDelete: string[]
): Promise<boolean> => {
  console.log(
    colors.red.bold.underline("You have selected these branches to delete:")
  );
  console.log(
    branchesToDelete
      .map((branchName, index) => ` ${index + 1}. ${branchName}`)
      .join("\n")
  );
  const response = await enquirer.prompt({
    type: "input",
    name: "confirmation",
    message: `Delete these ${
      branchesToDelete.length
    } branches? Type ${colors.green("yes")} or ${colors.green("no")}`,
    validate: (input: string) =>
      input === "yes" || input === "no" ? true : "Please answer 'yes' or 'no'",
  });
  //=> { confirmation: "yes" }
  const choice = response.confirmation === "yes";
  return choice;
};

const deleteBranches = (branchesToDelete: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const deletionPromises = branchesToDelete.map((branchName) => {
      return new Promise((resolveBranch, rejectBranch) => {
        const command = `git branch -D '${branchName}'`;
        console.log(command);
        child_process.exec(
          command,
          { encoding: "utf-8" },
          (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              console.error(`Error deleting branch ${branchName}:`, error);
              rejectBranch(error); // Reject the inner promise
              return;
            }
            console.log(stdout);
            resolveBranch(stdout); // Resolve the inner promise
          }
        );
      });
    });

    Promise.all(deletionPromises)
      .then(() => {
        console.log(colors.green("All selected branches deleted."));
        resolve();
      })
      .catch((error) => {
        reject(error); // Reject the outer promise if any inner promise rejects
      });
  });
};

const main = async (): Promise<void> => {
  if (!isGitRepository()) {
    console.log(
      colors.blue(
        "This is not a Git repository. Please go to a directoy with .git directory."
      )
    );
    return;
  }
  const branches = await getGitBranches();
  if (branches.length === 1 && branches[0].isCurrent) {
    console.log(
      colors.blue(
        "There is only one branch (the current branch). Nothing to do."
      )
    );
    return;
  }

  const branchesToDelete = await selectBranchNames(branches);
  if (branchesToDelete.length === 0) {
    return;
  }
  const confirmed = await askForConfirmation(branchesToDelete);
  if (!confirmed) {
    console.log("No branches deleted.");
    return;
  }
  try {
    await deleteBranches(branchesToDelete);
  } catch (error) {
    console.error("An error occurred while deleting branches:", error);
  }
};

main();

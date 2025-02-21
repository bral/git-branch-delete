# git-branch-delete

Interactive command line tool that makes it comfortable to delete several local Git branches at once, excluding the currently checked-out branch.

Demo:

![Demo](https://raw.githubusercontent.com/stefanwille/git-branch-delete/master/demo.gif "Demo")

## Installation

Using npm:

```bash
npm install -g bran-gbd
```

Using yarn:

```bash
yarn global add bran-gbd
```

For development (using `yarn link`):

```bash
yarn link
```

Note: If you are using `yarn link`, you need to build the project first by running `yarn build`.

## Usage

```bash
bran-gbd
```

or

```bash
bran-gbd
```

This starts a command line UI that helps you select and delete local Git branches.

The current branch is displayed above the interactive prompt and is not selectable. Use the up and down arrows to change the selected branch. The spacebar can be used to add a branch to the set of to-be-deleted branches. Pressing `Enter` will finalize the selection of branches to delete. Pressing `Esc` will exit the tool without deleting any branches.

## Publishing (for package maintainers)

1.  **Build the project:** `yarn build`
2.  **Unlink (if previously linked):** `yarn unlink`
3.  **Publish:** `npm publish`

# SSHIP

**SSHIP** - Simplify your SSH key management.

SSHIP is a command-line tool that helps you manage your SSH keys. It allows you to easily create, delete, list, and back up your SSH keys, as well as configure SSH connections. SSHIP uses a modern Bun/TypeScript CLI with Commander.js for robust command-line parsing and interactive prompts, providing a flexible and efficient solution.

## Table of Contents

*   [Features](#features)
*   [Architecture Overview](#architecture-overview)
*   [Installation](#installation)
*   [Usage](#usage)
*   [Development](#development)
*   [Contributing](#contributing)
*   [License](#license)

## Features

SSHIP offers a comprehensive set of features to manage your SSH keys efficiently:

*   **Key Creation (`create`):**
    *   Guides you through the process of generating new SSH key pairs.
    *   Supports command-line options (`-e`, `-p`, `-n`, `-h`, `-u`, `-P`) for non-interactive key generation.
    *   Prompts for essential details such as email address (for key comment), passphrase (optional), key name, and the associated host and user for SSH configuration if not provided via options.
    *   Generates `ed25519` type keys by default.
    *   Automatically adds an entry to your `~/.ssh/config` file for easy access.

*   **Key Deletion (`delete`):**
    *   Lists all detected SSH key pairs in your `~/.ssh/` directory.
    *   Allows you to select a specific key to delete interactively or specify it via command-line argument.
    *   Includes a confirmation step to prevent accidental deletions.
    *   Deletes both the private and public key files associated with the selected key and removes its entry from `~/.ssh/config`.

*   **Key Listing (`list`):**
    *   Scans your `~/.ssh/` directory for SSH key files (`.pub`, `.pem`, `.pkcs8`).
    *   Presents a clean, numbered list of all identified SSH key names.

*   **Backup (`backup`):**
    *   Creates a secure backup of your SSH keys and configuration files from `~/.ssh/`.
    *   Excludes sensitive files like `known_hosts` and `authorized_keys` from the backup.
    *   Archives the selected files into a `tar.gz` file (`~/sship_backup.tar.gz`).
    *   Optionally encrypts the backup archive using `gpg` with a provided passphrase for enhanced security.

*   **Connect (`connect`):**
    *   Lists available SSH aliases from your `~/.ssh/config` file.
    *   Allows you to select an alias to connect to interactively or specify it via command-line argument.
    *   Initiates an SSH connection using the selected alias.

*   **Doctor (`doctor`):**
    *   Checks your `~/.ssh/config` file for entries that reference non-existent SSH key files.
    *   Identifies and lists problematic entries.
    *   Offers an interactive option to delete these invalid entries from your SSH config, helping to maintain a clean and functional configuration.

*   **Onboarding (`onboard`):**
    *   Helps users set up unaliased private SSH keys.
    *   Scans your `~/.ssh/` directory for private keys that are not currently aliased in your `~/.ssh/config`.
    *   For each unaliased key, it interactively prompts the user to:
        *   Add a new alias for the key in `~/.ssh/config`.
        *   Add the key to an existing or new SSHIP profile.

*   **Manage Profiles (`manage-profiles`):**
    *   Provides interactive options to create, remove, rename, and list SSHIP user profiles.
    *   Profiles allow grouping related SSH keys for easier management.

*   **Uninstallation (`uninstall`):**
    *   Removes the SSHIP application directory (`~/sship`).
    *   Deletes the symbolic link created during installation (`~/.local/bin/sship`).

*   **Logging System:**
    *   Utilizes `ora` spinners for interactive progress display in the terminal.
    *   All application logs (info, success, failure, warnings) are written to `~/.sship/logs/sship.log` for persistent record-keeping and debugging.

## Architecture Overview

SSHIP is built as a modern Command-Line Interface (CLI) application using Bun and TypeScript, leveraging the Commander.js library for robust command parsing and management. It integrates with Bash scripts for system-level operations.

*   **Main Entry Point (`src/cli.ts`):**
    *   This file serves as the primary entry point for the CLI, powered by Commander.js.
    *   It registers all available commands (e.g., `create`, `delete`, `doctor`, `onboard`) and their respective options and actions.
    *   Handles command-line argument parsing and dispatches control to the appropriate command handler.

*   **Interactive Mode (`src/main.ts`):**
    *   Provides an interactive menu-driven interface for users who prefer guided execution.
    *   Uses `@inquirer/prompts` for interactive selections and inputs.
    *   Calls the same core command logic as the CLI mode, ensuring consistent behavior.

*   **Core Command Logic (`src/commands/*.ts`):**
    *   Each feature (e.g., `createKey.ts`, `deleteKey.ts`, `doctor.ts`, `onboard.ts`) has a dedicated TypeScript file containing its core business logic.
    *   These modules encapsulate the functionality and are designed to be reusable by both the CLI and interactive modes.

*   **CLI Command Registration (`src/cli-commands/*.ts`):**
    *   These files are responsible for registering each command with Commander.js, defining their descriptions, options, and actions.
    *   They act as a bridge between the Commander.js framework and the core command logic.

*   **Bash Integration (`scripts/commands/*.sh`):**
    *   For operations requiring direct system interaction (e.g., `ssh-keygen`, `tar`, `gpg`), SSHIP utilizes dedicated Bash scripts.
    *   These scripts are called by the TypeScript command logic, passing necessary arguments and handling their output.

*   **Utilities (`src/utils/*.ts`):**
    *   A collection of helper modules providing common functionalities such as:
        *   `logger.ts`: Centralized logging with Ora spinners and file output.
        *   `prompt.ts`, `select.ts`: Wrappers for interactive user input.
        *   `getAllFiles.ts`, `getKeys.ts`, `getPrivateKeys.ts`: File system and key identification helpers.
        *   `manageProfiles.ts`: Logic for managing user profiles.
        *   `command.ts`: Utility for running shell commands.

## Installation

To install SSHIP, ensure you have **Bun** installed on your system. Then, you can clone the repository and set it up:

```bash
git clone https://github.com/Makumiii/sship.git
cd sship
bun install
```

**Prerequisites:**
*   `Bun`: The JavaScript/TypeScript runtime.
*   `jq`: A lightweight and flexible command-line JSON processor (used by Bash scripts).
*   `gpg`: GNU Privacy Guard (for optional backup encryption).

## Usage

SSHIP can be used in two primary ways:

1.  **Interactive Mode:**
    Run the main application to get an interactive menu:
    ```bash
    bun run src/main.ts
    ```
    Follow the on-screen prompts to choose your desired SSH key management task.

2.  **CLI Mode:**
    Execute specific commands directly with options. For example:
    ```bash
    bun run src/cli.ts create -n my_new_key -e my@example.com -p mypassphrase -h github.com -u git
    bun run src/cli.ts delete my_old_key
    bun run src/cli.ts doctor
    bun run src/cli.ts onboard
    ```
    For help on any command, use the `--help` flag:
    ```bash
    bun run src/cli.ts create --help
    ```

## Development

If you wish to contribute to SSHIP or run it directly from the source:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Makumiii/sship.git
    cd sship
    ```
2.  **Install Bun:** Follow the instructions on the [Bun website](https://bun.sh/#install).
3.  **Install dependencies:**
    ```bash
    bun install
    ```
4.  **Install `jq` and `gpg`:**
    *   **Debian/Ubuntu:** `sudo apt-get install jq gnupg`
    *   **macOS (Homebrew):** `brew install jq gnupg`
5.  **Run in development mode:**
    ```bash
    bun run src/main.ts
    ```
    Or directly execute CLI commands:
    ```bash
    bun run src/cli.ts [command] [options]
    ```

## Contributing

Contributions are welcome! If you have suggestions, bug reports, or want to contribute code, please feel free to open an issue or pull request on the [GitHub repository](https://github.com/Makumiii/sship).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

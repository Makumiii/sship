# SSHIP

**SSHIP** - Simplify your SSH key management.

SSHIP is a command-line tool that helps you manage your SSH keys. It allows you to easily create, delete, list, and back up your SSH keys, as well as configure SSH connections. SSHIP uses a combination of Deno/TypeScript for interactive prompts and Bash for system operations, providing a flexible and robust solution.

## Table of Contents

*   [Features](#features)
*   [Architecture Overview](#architecture-overview)
*   [Installation](#installation)
*   [Usage](#usage)
*   [Development](#development)
*   [Contributing](#contributing)
*   [License](#license)
*   [Coming Soon](#coming-soon)

## Features

SSHIP offers a comprehensive set of features to manage your SSH keys efficiently:

*   **Key Creation (`create`):**
    *   Guides you through the process of generating new SSH key pairs.
    *   Prompts for essential details such as email address (for key comment), passphrase (optional), key name, and the associated host and user for SSH configuration.
    *   Generates `ed25519` type keys by default.
    *   Automatically adds an entry to your `~/.ssh/config` file for easy access.

*   **Key Deletion (`delete`):**
    *   Lists all detected SSH key pairs in your `~/.ssh/` directory.
    *   Allows you to select a specific key to delete.
    *   Includes a confirmation step to prevent accidental deletions.
    *   Deletes both the private and public key files associated with the selected key.

*   **Key Listing (`list`):**
    *   Scans your `~/.ssh/` directory for SSH key files (`.pub`, `.pem`, `.pkcs8`).
    *   Presents a clean, numbered list of all identified SSH key names (e.g., `id_rsa`, `my_key`).

*   **Backup (`backup`):**
    *   Creates a secure backup of your SSH keys and configuration files from `~/.ssh/`.
    *   Excludes sensitive files like `known_hosts` and `authorized_keys` from the backup.
    *   Archives the selected files into a `tar.gz` file (`~/sship_backup.tar.gz`).
    *   Optionally encrypts the backup archive using `gpg` with a provided passphrase for enhanced security.

*   **Configuration Helper (Internal - `sshConf.sh`):**
    *   Automatically invoked during key creation.
    *   Adds or updates entries in your `~/.ssh/config` file based on the key name, machine user, and host.
    *   Ensures your SSH client can easily connect to your defined hosts using the correct identity file.

*   **Uninstallation (`uninstall`):**
    *   Removes the SSHIP application directory (`~/sship`).
    *   Deletes the symbolic link created during installation (`~/.local/bin/sship`).

## Architecture Overview

SSHIP employs a hybrid architecture combining Bash shell scripting with Deno and TypeScript, offering a robust and flexible solution for SSH key management.

*   **Entry Point (`src/run.sh`):**
    *   The primary executable script that users interact with.
    *   Sets strict shell options (`set -euo pipefail`) for robust error handling.
    *   Launches the main Deno application (`src/main.ts`) to present the initial task selection menu.
    *   Reads the user's chosen task from a temporary JSON file (`/tmp/sship/sship-task-responses.json`).
    *   Dispatches control to the appropriate command-specific Bash script (e.g., `src/commands/createKey.sh`, `src/commands/deleteKey.sh`) based on the user's selection.

*   **Main Application Logic (`src/main.ts`):**
    *   Written in TypeScript and executed by Deno.
    *   Uses the `@inquirer/prompts` library for interactive command-line menus.
    *   Presents the main menu of SSHIP tasks (create, delete, backup, list, uninstall).
    *   Handles graceful exit on `Ctrl+C` by catching `ExitPromptError` from the inquirer library, ensuring a clean termination.
    *   Writes the user's chosen task to a temporary JSON file for `run.sh` to read.

*   **Command-Specific Logic (`src/commands/*.sh` and `src/commands/*.ts`):**
    *   Each primary feature (create, delete, backup, list) has a dedicated Bash script (`.sh`) and a corresponding TypeScript file (`.ts`).
    *   **Bash Scripts (`.sh`):** Handle system-level operations, file manipulation, and execution of external commands like `ssh-keygen`, `tar`, `gpg`, `jq`, and `deno run`. They act as orchestrators for their respective features.
    *   **TypeScript Files (`.ts`):** Focus on user interaction, data validation, and complex logic that benefits from TypeScript's type safety and Deno's powerful APIs (e.g., reading directories, file deletion). They receive arguments from their parent Bash scripts and write responses back to temporary files.

*   **Core Utilities (`src/io.ts`, `src/select.ts`, `src/prompt.ts`, `src/types.ts`, `src/getAllFiles.ts`, `src/getKeys.ts`):**
    *   **`src/io.ts`:** Manages reading from and writing to temporary JSON files (`/tmp/sship/`) to facilitate data exchange between Bash and Deno/TypeScript components.
    *   **`src/select.ts`:** Provides a wrapper around `@inquirer/prompts` for creating interactive selection menus.
    *   **`src/prompt.ts`:** Handles general user input prompts using `@inquirer/prompts`.
    *   **`src/types.ts`:** Defines TypeScript interfaces and types for data structures used throughout the application, ensuring type safety and code clarity.
    *   **`src/getAllFiles.ts`:** Utility to list files within a given directory.
    *   **`src/getKeys.ts`:** Utility to extract SSH key names from a list of file names.

*   **Installation/Uninstallation Scripts (`src/install.sh`, `src/uninstall.sh`):**
    *   Dedicated Bash scripts for setting up and tearing down the SSHIP environment, including cloning the repository and creating symbolic links for easy execution.

## Installation

To install SSHIP, simply run the following command in your terminal:

```bash
curl -sSL https://raw.githubusercontent.com/Makumiii/sship/main/src/install.sh | bash
```

This script will:
1.  Clone the SSHIP repository into your `$HOME/sship` directory.
2.  Create a symbolic link to the `run.sh` script in `$HOME/.local/bin/sship`, making it globally accessible.
3.  Make the `sship` executable.

**Prerequisites:**
*   `git`: For cloning the repository.
*   `deno`: The JavaScript/TypeScript runtime.
*   `jq`: A lightweight and flexible command-line JSON processor (used by Bash scripts).
*   `gpg`: GNU Privacy Guard (for optional backup encryption).

## Usage

After installation, you can run SSHIP from any directory in your terminal:

```bash
sship
```

This will present you with an interactive menu to choose your desired SSH key management task. Follow the on-screen prompts to complete the operations.

## Development

If you wish to contribute to SSHIP or run it directly from the source:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Makumiii/sship.git
    cd sship
    ```
2.  **Install Deno:** Follow the instructions on the [Deno website](https://deno.land/#installation).
3.  **Install `jq` and `gpg`:**
    *   **Debian/Ubuntu:** `sudo apt-get install jq gnupg`
    *   **macOS (Homebrew):** `brew install jq gnupg`
4.  **Run in development mode:**
    ```bash
    deno task dev
    ```
    Or directly execute the `run.sh` script:
    ```bash
    ./src/run.sh
    ```

## Contributing

Contributions are welcome! If you have suggestions, bug reports, or want to contribute code, please feel free to open an issue or pull request on the [GitHub repository](https://github.com/Makumiii/sship).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Coming Soon

*   **Auto-regeneration:** Automatically regenerate SSH keys after a set period for enhanced security.
*   **Port Forwarding:** Establish local and remote port forwarding connections.
*   **Smart Profiles:** Create and save frequently used SSH connection profiles.
*   **One-shot Scripts:** Run single-use automation scripts via SSH.
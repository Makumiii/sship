# SSHIP

![SSHIP Screenshot](https://raw.githubusercontent.com/Makumiii/sship/main/assets/sship-logo.png)

**SSHIP** is the ultimate SSH companion tool. It simplifies your SSH key management and introduces **Synergy**, a beautiful, modern file transfer interface directly in your browser.

## Flagship Feature: Synergy

Say goodbye to clunky FTP clients. **Synergy** is a built-in, polished SFTP interface that runs locally and connects to your servers with zero setup.

*   **Beautiful UI:** A clean, focused interface with fast navigation.
*   **Drag & Drop:** Upload and download files (including directories) by dragging between panes.
*   **Real-time Progress:** Visual progress and status updates for transfers.
*   **Secure & Direct:** Uses your SSH config and PEM servers with no passwords stored.
*   **Smart Actions:** Context-aware upload/download actions and refreshable connections.

Run it instantly:
```bash
sship transfer
```

---

## Core Features

SSHIP provides a comprehensive suite of tools for efficient SSH management:

*   **Service Keys**
    *   **Create (`sship create`):** Generate ed25519 keys and write SSH config entries for third-party services.
    *   **List/Delete (interactive):** Manage only keys created through SSHIP service keys.
    *   **Onboard (`sship onboard`):** Import existing keys into the SSHIP system.
*   **Server Connections (PEM)**
    *   **Manage servers:** Add, edit, delete, connect, and test PEM-based server entries.
*   **Tunnel Manager**
    *   **Discover and bind:** Auto-discover remote listening ports and bind them locally.
    *   **Manage tunnels:** Start, stop, and delete saved tunnels.
*   **Utilities**
    *   **Doctor (`sship doctor`):** Diagnose and fix broken SSH config entries.
    *   **Backup (`sship backup`):** Securely backup your keys (GPG encryption supported).

## Installation

### Option 1: Via npm (Recommended)
The easiest way to install SSHIP is via npm. This works on macOS, Linux, and Windows (via WSL).

```bash
npm install -g sship
```

### Option 2: Via Install Script (Linux/macOS)
For a quick, dependency-free setup on Unix-like systems:

```bash
curl -fsSL https://raw.githubusercontent.com/Makumiii/sship/main/scripts/bash/install.sh | sh
```

### Option 3: Manual / Development
If you want to hack on SSHIP:

1.  Clone the repo: `git clone https://github.com/Makumiii/sship.git`
2.  Install dependencies: `bun install`
3.  Build: `bun run build`

## Usage

### File Transfer (Synergy)
Launch the web interface to transfer files between your local machine and any configured server.
```bash
sship transfer
```

### Service Keys
Create a new key for GitHub (for example):
```bash
sship create -n github-key -e me@gmail.com -h github.com -u git
```

Manage service keys via the interactive menu:
```bash
sship
```

### Tunnel Manager
Discover a remote port and bind it locally:
```bash
sship tunnel discover
```

### Server Connections (PEM)
Use the interactive server manager to add, connect, edit, or test PEM servers:
```bash
sship
```

### Doctor
Fix configuration issues:
```bash
sship doctor
```

## Contributing
Contributions are welcome! Please open an issue or pull request on the [GitHub repository](https://github.com/Makumiii/sship).

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

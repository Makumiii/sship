# SSHIP 🚀

![SSHIP Screenshot](assets/sship-logo.png)

**SSHIP** is the ultimate SSH companion tool. It simplifies your SSH key management and introduces **Synergy**, a beautiful, modern file transfer interface directly in your browser.

## 🌟 Flagship Feature: Synergy

Say goodbye to clunky FTP clients. **Synergy** is a built-in, polished SFTP interface that runs locally and connects to your servers with zero setup.

*   **Beautiful UI:** A stunning "Cupertino Dark" aesthetic with glassmorphism effects and smooth animations.
*   **Drag & Drop:** Upload and download files effortlessly by dragging them between panes.
*   **Real-time Progress:** Visual progress bars and status updates for all your transfers.
*   **Secure & Direct:** Uses your existing SSH keys (`~/.ssh/config`) to connect securely. No passwords stored, ever.
*   **Smart Actions:** Intelligent context-aware buttons for uploading and downloading.

Run it instantly:
```bash
sship transfer
```

---

## ⚡ Core Features

SSHIP provides a comprehensive suite of tools for efficient SSH management:

*   **🔑 Key Management**
    *   **Create (`sship create`):** Generate ed25519 keys with auto-config updates.
    *   **Delete (`sship delete`):** Safely remove keys and clean up config entries.
    *   **List (`sship list`):** See all your managed keys at a glance.
    *   **Onboard (`sship onboard`):** Import existing keys into the SSHIP system.

*   **🛠️ Utilities**
    *   **Connect (`sship connect`):** Rapidly connect to your servers using an interactive list.
    *   **Doctor (`sship doctor`):** Diagnose and fix broken SSH config entries.
    *   **Backup (`sship backup`):** Securely backup your keys (GPG encryption supported).
    *   **Profiles (`sship profile`):** Switch between different sets of keys (e.g., Personal vs. Work).

## 📦 Installation

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

## 🚀 Usage

### File Transfer (Synergy)
Launch the web interface to transfer files between your local machine and any server in your SSH config.
```bash
sship transfer
```

### SSH Key Management
Create a new key for GitHub (for example):
```bash
sship create -n github-key -e me@gmail.com -h github.com -u git
```

Connect to a server interactively:
```bash
sship connect
```

Fix configuration issues:
```bash
sship doctor
```

## 🤝 Contributing
Contributions are welcome! Please open an issue or pull request on the [GitHub repository](https://github.com/Makumiii/sship).

## 📝 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

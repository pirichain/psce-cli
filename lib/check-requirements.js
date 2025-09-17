const os = require("os");
const { execSync } = require("child_process");

/**
 * Check if keytar can run on this system
 * @returns {Object} - Check result with canInstall and message
 */
function checkKeytarRequirements() {
  const platform = os.platform();

  // Windows and macOS - no additional requirements
  if (platform === "win32" || platform === "darwin") {
    return { canInstall: true };
  }

  // Linux - check for libsecret
  if (platform === "linux") {
    try {
      execSync("ldconfig -p | grep libsecret-1 >/dev/null 2>&1");
      return { canInstall: true };
    } catch (error) {
      const distro = detectLinuxDistro();
      const commands = getInstallCommands(distro);

      return {
        canInstall: false,
        platform: "linux",
        distro: distro,
        message: `
❌ Missing required system dependency: libsecret

To install on ${distro}:
${commands.map((cmd) => `  ${cmd}`).join("\n")}

After installation, run:
  npm install -g psce

`,
        commands: commands,
      };
    }
  }

  // Other platforms - assume they work
  return { canInstall: true };
}

function detectLinuxDistro() {
  try {
    const osRelease = execSync('cat /etc/os-release 2>/dev/null || echo ""', {
      encoding: "utf8",
    });

    if (osRelease.includes("Ubuntu") || osRelease.includes("Debian")) {
      return "Debian/Ubuntu";
    } else if (
      osRelease.includes("Red Hat") ||
      osRelease.includes("CentOS") ||
      osRelease.includes("Fedora") ||
      osRelease.includes("RHEL")
    ) {
      return "Red Hat/CentOS/Fedora";
    } else if (osRelease.includes("Arch")) {
      return "Arch Linux";
    } else if (osRelease.includes("SUSE")) {
      return "SUSE";
    }

    // Fallback detection
    try {
      execSync("which apt-get >/dev/null 2>&1");
      return "Debian/Ubuntu";
    } catch (e) {
      try {
        execSync("which yum >/dev/null 2>&1");
        return "Red Hat/CentOS";
      } catch (e) {
        try {
          execSync("which pacman >/dev/null 2>&1");
          return "Arch Linux";
        } catch (e) {
          return "Linux";
        }
      }
    }
  } catch (error) {
    return "Linux";
  }
}

function getInstallCommands(distro) {
  const commands = {
    "Debian/Ubuntu": [
      "sudo apt-get update",
      "sudo apt-get install libsecret-1-dev",
    ],
    "Red Hat/CentOS/Fedora": [
      "sudo yum install libsecret-devel",
      "# Or: sudo dnf install libsecret-devel",
    ],
    "Arch Linux": ["sudo pacman -S libsecret"],
    SUSE: ["sudo zypper install libsecret-devel"],
    Linux: [
      "# Install libsecret development files for your distribution",
      "# Common package names: libsecret-1-dev, libsecret-devel, libsecret",
    ],
  };

  return commands[distro] || commands["Linux"];
}

// CLI execution
if (require.main === module) {
  const result = checkKeytarRequirements();

  if (!result.canInstall) {
    console.error(result.message);
    process.exit(1);
  }

  console.log("✅ System requirements satisfied");
}

module.exports = { checkKeytarRequirements };

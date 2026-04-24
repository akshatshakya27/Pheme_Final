"""Configuration for Safe Exam Guard."""

# Processes that are safe/required for Windows to function or for this script itself.
# Keep names in lowercase.
DEFAULT_ALLOWED_PROCESSES = {
    "system idle process",
    "system",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "dwm.exe",
    "winlogon.exe",
    "explorer.exe",
    "taskhostw.exe",
    "sihost.exe",
    "ctfmon.exe",
    "runtimebroker.exe",
    "searchhost.exe",
    "startmenuexperiencehost.exe",
    "securityhealthservice.exe",
    "securityhealthsystray.exe",
    "audiodg.exe",
    "spoolsv.exe",
    "python.exe",
    "pythonw.exe",
    "powershell.exe",
    "windowsterminal.exe",
    "conhost.exe",
}

# Optional process names that should always trigger warning if running.
# Example: {"discord.exe", "steam.exe"}
ALWAYS_BLOCKED_PROCESSES = {"cmd.exe"}

# Add machine-specific process names here to prevent false alerts.
# Example: {"onedrive.exe", "your-security-agent.exe"}
USER_ALLOWED_PROCESSES = {"code.exe"}

# Refresh interval in seconds.
CHECK_INTERVAL_SECONDS = 3

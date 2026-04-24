import os
import platform
import time
import ctypes
from ctypes import wintypes
from typing import Dict, List, Set, Tuple

import psutil

from config import (
    ALWAYS_BLOCKED_PROCESSES,
    CHECK_INTERVAL_SECONDS,
    DEFAULT_ALLOWED_PROCESSES,
    USER_ALLOWED_PROCESSES,
)


WINDOWS_SERVICE_USERS = {
    "nt authority\\system",
    "nt authority\\local service",
    "nt authority\\network service",
}

GW_OWNER = 4
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080
DWMWA_CLOAKED = 14


def get_interactive_app_window_pids() -> Set[int]:
    """Return PIDs for windows that look like real user-facing application windows."""
    if platform.system().lower() != "windows":
        return set()

    visible_pids: Set[int] = set()

    user32 = ctypes.windll.user32
    dwmapi = ctypes.windll.dwmapi
    enum_windows_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.GetWindowLongPtrW.restype = ctypes.c_longlong

    def _is_cloaked(hwnd: int) -> bool:
        cloaked = wintypes.DWORD(0)
        try:
            result = dwmapi.DwmGetWindowAttribute(
                wintypes.HWND(hwnd),
                wintypes.DWORD(DWMWA_CLOAKED),
                ctypes.byref(cloaked),
                ctypes.sizeof(cloaked),
            )
            return result == 0 and bool(cloaked.value)
        except Exception:
            return False

    def _callback(hwnd: int, lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd):
            return True

        if user32.GetWindow(hwnd, GW_OWNER):
            return True

        # Ignore tool windows and overlays.
        if ctypes.sizeof(ctypes.c_void_p) == 8:
            ex_style = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
        else:
            ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        if ex_style & WS_EX_TOOLWINDOW:
            return True

        # Ignore hidden/virtualized windows that are not user-facing.
        if _is_cloaked(hwnd):
            return True

        # Require a non-empty title to focus on windows the user can close directly.
        if user32.GetWindowTextLengthW(hwnd) <= 0:
            return True

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value:
            visible_pids.add(int(pid.value))
        return True

    user32.EnumWindows(enum_windows_proc(_callback), 0)
    return visible_pids


def clear_console() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def normalize_name(name: str) -> str:
    return (name or "").strip().lower()


def is_essential_system_process(proc: psutil.Process) -> bool:
    """Best-effort check for required OS/service processes that should be ignored."""
    if platform.system().lower() != "windows":
        return False

    try:
        if proc.pid <= 4:
            return True

        username = normalize_name(proc.username() or "")
        if username in WINDOWS_SERVICE_USERS:
            return True

        # Many critical Windows binaries run from %WINDIR% under service accounts.
        exe_path = normalize_name(proc.exe() or "")
        windir = normalize_name(os.environ.get("WINDIR", r"C:\Windows"))
        if exe_path.startswith(windir + "\\") and username.startswith("nt authority\\"):
            return True

        return False
    except (psutil.NoSuchProcess, psutil.ZombieProcess):
        return True
    except psutil.AccessDenied:
        # Protected/system processes are often access-restricted.
        return True


def find_apps_to_close(allowed: Set[str], always_blocked: Set[str]) -> List[Tuple[str, int]]:
    """Return sorted list of (process_name, count) that should be closed."""
    flagged_counts: Dict[str, int] = {}

    visible_pids = get_interactive_app_window_pids()

    for proc in psutil.process_iter(attrs=["pid", "name"]):
        try:
            info = proc.info
            process_name = normalize_name(info.get("name") or "")
            if not process_name:
                continue

            pid = int(info.get("pid") or 0)
            if pid <= 0:
                continue

            if process_name in always_blocked:
                flagged_counts[process_name] = flagged_counts.get(process_name, 0) + 1
                continue

            if process_name in allowed:
                continue

            if is_essential_system_process(proc):
                continue

            # Only enforce closing apps the user can interact with directly.
            if pid not in visible_pids:
                continue

            flagged_counts[process_name] = flagged_counts.get(process_name, 0) + 1
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, TypeError, ValueError):
            continue

    flagged = sorted(flagged_counts.items(), key=lambda item: item[0])
    return flagged


def print_status(flagged: List[Tuple[str, int]]) -> None:
    print("SAFE EXAM GUARD")
    print("=" * 50)

    if flagged:
        print("Please close these applications before continuing:\n")
        for name, count in flagged:
            print(f"- {name} (instances: {count})")
        print("\nAfter closing them, wait for the next scan...")
    else:
        print("welcome home")


def notify_done() -> None:
    if platform.system().lower() == "windows":
        ctypes.windll.user32.MessageBoxW(0, "welcome home", "Safe Exam Guard", 0x40)


def run_guard_loop() -> None:
    allowed = {normalize_name(x) for x in DEFAULT_ALLOWED_PROCESSES}.union(
        {normalize_name(x) for x in USER_ALLOWED_PROCESSES}
    )
    always_blocked = {normalize_name(x) for x in ALWAYS_BLOCKED_PROCESSES}

    if platform.system().lower() != "windows":
        print("Warning: This script is designed for Windows and may behave differently on other OSes.")
        print()

    while True:
        flagged = find_apps_to_close(allowed, always_blocked)

        clear_console()
        print_status(flagged)

        if not flagged:
            notify_done()
            break

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        run_guard_loop()
    except KeyboardInterrupt:
        print("\nStopped by user.")

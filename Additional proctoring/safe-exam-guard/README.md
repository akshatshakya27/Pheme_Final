# Safe Exam Guard

A lightweight Python desktop utility for Windows that helps ensure non-essential apps are closed before starting a focused exam/session.

## What it does

- Detects currently running processes.
- Ignores essential Windows/system processes.
- Prompts the user to close detected non-essential apps.
- Keeps checking until only allowed processes remain.
- Displays **"welcome home"** when done.

## Setup

1. Create and activate a virtual environment (recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

## Notes

- This tool does **not** force-kill applications by default.
- You can customize allowed/blocked process names in `config.py`.
- Requires Windows for best results.

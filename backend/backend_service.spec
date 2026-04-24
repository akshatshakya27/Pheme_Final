# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_backend_service.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        'app.main',
        'app.routers.exams',
        'app.routers.auth',
        'app.routers.questions',
        'app.routers.batches',
        'app.routers.assignments',
        'app.routers.institutes',
        'app.routers.users',
        'app.routers.sessions',
        'app.routers.departments',
        'app.routers.faculties',
        'app.routers.proctoring',
        'app.routers.desktop_exam',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'IPython',
        'jupyter',
        'pytest',
        'tkinter',
    ],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend_service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

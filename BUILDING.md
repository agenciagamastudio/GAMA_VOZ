# Building GAMA_VOZ from Source

This document describes how to build the GAMA_VOZ desktop application from source on Windows 10/11.

## Prerequisites

### 1. System Requirements
- **OS:** Windows 10 (build 19045) or Windows 11
- **RAM:** 4GB minimum (8GB recommended for compilation)
- **Disk:** 2GB free space for dependencies + build output
- **Internet:** Required for downloading Python packages and models

### 2. Software Dependencies

#### Python 3.9 or Higher
1. Download from [python.org](https://www.python.org/downloads/)
2. **IMPORTANT:** Check "Add Python to PATH" during installation
3. Verify installation:
   ```powershell
   python --version
   pip --version
   ```

#### Git (Optional, for cloning repository)
1. Download from [git-scm.com](https://git-scm.com/download/win)
2. Use default settings
3. Verify:
   ```powershell
   git --version
   ```

#### Visual C++ Build Tools (Required for numpy, scipy)
1. Download from [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Run installer → Select "Desktop development with C++" → Install
3. Requires ~4GB disk space, ~30 minutes

#### Node.js 18+ (For building React frontend)
1. Download LTS from [nodejs.org](https://nodejs.org/)
2. Use default settings, check "Add to PATH"
3. Verify:
   ```powershell
   node --version
   npm --version
   ```

## Build Steps

### Step 1: Clone or Navigate to Repository
```powershell
# If cloning:
git clone https://github.com/YOUR_ORG/GAMA_VOZ.git
cd GAMA_VOZ

# If already local:
cd C:\Users\<YourUsername>\Desktop\O_GRANDE_PROJETO\GAMA_VOZ
```

### Step 2: Set Up Python Environment
```powershell
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# If execution policy blocks activation:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

### Step 3: Install Python Dependencies
```powershell
# Install from requirements.txt
pip install -r backend/requirements.txt

# This includes:
# - Flask 3.0.0 (web framework)
# - Kokoro TTS (local speech synthesis, Portuguese-native)
# - Groq API client (for STT fallback)
# - NumPy/SciPy (numerical computing)
# - PyInstaller (for .exe compilation)
# - PyJWT, python-dotenv, SQLAlchemy (utilities)
# - pytest (testing framework)

# Expected time: 5-15 minutes (first run may download ~500MB)
# If kokoro download hangs, see Troubleshooting section below
```

### Step 4: Build React Frontend
```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Expected output: dist/ folder with optimized React app
# Expected time: 2-3 minutes
# Expected size: ~200KB gzipped

# Return to project root
cd ..
```

### Step 5: Run Tests (Local Verification)
```powershell
# Ensure virtual environment is active
# Run all pytest tests with coverage
pytest backend/ -v --cov=backend --cov-report=term-missing

# Expected:
# - All tests PASS (green ✓)
# - Coverage >= 80%
# - No errors or warnings

# If tests fail, see Troubleshooting section
```

### Step 6: Compile .exe with PyInstaller
```powershell
# Run the Windows build script
.\build\windows_build.ps1

# Expected output:
# - Console messages showing build progress
# - File created: build/dist/GAMA_VOZ.exe
# - File size: 150-200 MB
# - Build time: 5-10 minutes (first run is slower)

# If PowerShell blocks execution:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\build\windows_build.ps1
```

### Step 7: Verify .exe
```powershell
# Check file exists and size
Get-Item build/dist/GAMA_VOZ.exe | Select-Object FullName, Length

# Expected: ~150-200 MB

# Test basic launch (no arguments)
.\build\dist\GAMA_VOZ.exe

# Expected behavior:
# - Console opens (if not windowed mode)
# - Flask server starts on localhost:8000
# - Press Ctrl+C to stop

# Open browser to verify:
# http://localhost:8000/
# Should see React UI + Flask responding

# Close with Ctrl+C
```

## Verification Checklist

After completing build steps, verify:

- [x] Python 3.9+ installed and in PATH
- [x] Virtual environment activated
- [x] backend/requirements.txt installed without errors
- [x] frontend/dist/ folder exists (React build successful)
- [x] `pytest backend/` all tests PASS
- [x] build/dist/GAMA_VOZ.exe exists
- [x] build/dist/GAMA_VOZ.exe is 150-200 MB
- [x] .exe launches and responds to HTTP requests on localhost:8000
- [x] No errors in console output during .exe execution

## Expected Times

| Step | Time | Cumulative |
|------|------|-----------|
| Python + dependencies | 10-20 min | 10-20 min |
| React frontend build | 2-3 min | 12-23 min |
| Run tests | 1-2 min | 13-25 min |
| PyInstaller .exe build | 5-10 min | 18-35 min |
| Verification | 2-5 min | 20-40 min |
| **Total** | | **~30 minutes** |

## Troubleshooting

### Issue: Python not found in PowerShell
**Symptom:** `python: The term 'python' is not recognized`

**Solution:**
1. Reinstall Python, **check "Add Python to PATH"**
2. Restart PowerShell or terminal
3. Or use full path: `C:\Program Files\Python311\python.exe --version`

---

### Issue: Virtual environment activation fails
**Symptom:** `cannot be loaded because running scripts is disabled`

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

---

### Issue: Kokoro download hangs or fails
**Symptom:** `pip install` hangs at kokoro, or "Connection refused" error

**Solution:**
1. Kokoro may be downloading large models (~500MB) — wait 5-10 minutes
2. If it times out, manually download: [Kokoro releases](https://github.com/Hexgrad/Kokoro) (if public)
3. Or install smaller version: `pip install kokoro-tts --no-deps` (basic package only)
4. Models will be lazy-loaded at runtime (first TTS call triggers download)

---

### Issue: numpy/scipy installation fails
**Symptom:** `error: Microsoft Visual C++ 14.0 is required`

**Solution:**
1. Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Select "Desktop development with C++" workload
3. Restart PowerShell and pip install again

---

### Issue: pytest tests fail
**Symptom:** `FAILED: test_*.py` or `ImportError: No module named 'X'`

**Solution:**
1. Ensure virtual environment is active: `(venv)` should appear in prompt
2. Reinstall requirements: `pip install -r backend/requirements.txt --force-reinstall`
3. Check test file imports: `head -5 backend/test_*.py`
4. If specific module missing: `pip install <module-name>`

---

### Issue: PyInstaller .exe is too large (>300MB)
**Symptom:** `build/dist/GAMA_VOZ.exe` is larger than expected

**Solution:**
1. This is usually normal for first builds (includes all Python + models)
2. Future builds will be faster and cache dependencies
3. To reduce: exclude debug symbols in `build/windows_build.ps1`:
   ```powershell
   pyinstaller --strip ...
   ```

---

### Issue: .exe fails to start or crashes immediately
**Symptom:** Executable launches but closes, or Windows "App crashed" popup

**Solution:**
1. Run with console output to see error: `.\build\dist\GAMA_VOZ.exe 2>&1 | tee output.log`
2. Check Flask startup: Does "* Running on" message appear?
3. Check Kokoro: Does "Kokoro TTS loaded" message appear?
4. If Kokoro missing: Models not downloaded yet. This is normal — will download on first TTS call
5. Manually test Flask: `python backend/app.py` (outside of .exe)

---

### Issue: Windows Defender / SmartScreen blocks .exe
**Symptom:** "Windows protected your PC" warning, "Publisher unknown"

**Solution:**
1. **Temporary:** Click "More info" → "Run anyway"
2. **Permanent:** Code-signing (requires SSL certificate, deferred to Phase 2)
3. **Admin install:** Right-click installer → "Run as Administrator"
4. **Whitelist:** Add to Windows Defender exception list (Advanced antivirus options)

---

## Build System Architecture

```
GAMA_VOZ/
├── backend/
│   ├── app.py          (Flask entry point)
│   ├── requirements.txt (ALL dependencies)
│   ├── auth.py         (License validation)
│   └── test_*.py       (Unit tests)
│
├── frontend/
│   ├── src/            (React components)
│   ├── dist/           (Build output — MUST exist before PyInstaller)
│   └── package.json
│
├── build/
│   ├── windows_build.ps1    (Build automation script)
│   ├── torch_hook.py        (PyInstaller module hooks)
│   ├── GAMA_VOZ.spec        (PyInstaller configuration)
│   └── dist/                (Final .exe location)
│
└── .env                (API keys, config — NOT in git)
```

## Build Configuration

### PyInstaller Options (in build/windows_build.ps1)
```powershell
--onefile              # Single .exe file (not folder)
--windowed             # No console window (remove for debugging)
--icon=icon.ico        # Custom icon (optional)
--add-data             # Include model files
--hidden-import        # Include obscure modules
```

### Key Build Parameters
| Parameter | Value | Reason |
|-----------|-------|--------|
| `--onefile` | Enabled | Simpler distribution (single .exe) |
| `--windowed` | Disabled (for now) | Show console for troubleshooting |
| `--optimize` | 2 | Remove doc strings, optimize bytecode |
| `--strip` | No | Keep debug info for now |

## Environment Variables

The `.env` file (in project root, not in git) must contain:

```env
FLASK_ENV=production
DEBUG=False
GROQ_API_KEY=sk-your-api-key-here
```

**Warning:** Never commit `.env` to git. It contains sensitive API keys.

## Next Steps After Building

1. **Test .exe locally:** Run `.\build\dist\GAMA_VOZ.exe`
2. **Test on clean VM:** Move .exe to a machine WITHOUT Python installed → should still work
3. **Create installer (STORY-004):** Wrap .exe in NSIS installer for C:\Program Files\ installation
4. **Test auto-update (STORY-004):** Update .exe from GitHub releases
5. **Code signing (STORY-004, Phase 2):** Get SSL certificate to remove SmartScreen warning

## References

- [PyInstaller Documentation](https://pyinstaller.org/)
- [Flask Deployment Guide](https://flask.palletsprojects.com/deployment/)
- [Windows .exe Bundling Best Practices](https://docs.python.org/3/library/freezegun.html)
- [Kokoro TTS Repository](https://github.com/Hexgrad/Kokoro)

---

**Last Updated:** 2026-05-27
**Version:** 1.0
**Status:** Production-ready for Windows 10/11

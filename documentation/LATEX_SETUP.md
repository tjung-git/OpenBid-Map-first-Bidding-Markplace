# LaTeX Documentation Setup

This document explains how to compile the project proposal LaTeX documents.

## Prerequisites

### LaTeX Distribution

**macOS (Recommended - Homebrew):**
```bash
# Install Homebrew if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MacTeX using Homebrew:
brew install --cask mactex

# Add LaTeX to your PATH (add to ~/.zshrc or ~/.bash_profile):
echo 'export PATH="/Library/TeX/texbin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**macOS (Alternative Methods):**
- Download [MacTeX.pkg](https://www.tug.org/mactex/) directly and install via GUI
- For minimal installation: `brew install --cask basictex` (then install additional packages as needed)

**Windows:**
- Install [MiKTeX](https://miktex.org/download) (recommended for Windows)
- Or install [TeX Live](https://www.tug.org/texlive/windows.html)

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install texlive-full
```

### Make Utility

**macOS:**
- Make is pre-installed on macOS. Verify with:
  ```bash
  make --version
  ```
- If you need a newer version, install via Homebrew:
  ```bash
  brew install make
  ```

**Windows:**
- Install via Chocolatey: `choco install make`
- Or use WSL: Install Windows Subsystem for Linux

**Linux:**
- Typically pre-installed. If not: `sudo apt-get install make`

### latexmk (Recommended)

**macOS:**
- Included with MacTeX installation via Homebrew
- Verify: `latexmk --version`
- If missing: `sudo tlmgr install latexmk`

## Building the Project Proposal

```bash
# From repo root
# Clean LaTeX compilation artifacts
make clean-latex

# Show available commands
make help
```

## Manual Compilation

```bash
# Both code blocks should only be run from the repo root directory

# Create Project Proposal 1.1 as a PDF file
cd "documentation/1.1 Project Proposal" 
pdflatex main.tex

# Create Project Proposal 1.2 as a PDF file
cd "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype" 
pdflatex main.tex
```

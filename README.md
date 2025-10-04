# OpenBid: Map-first Bidding Marketplace

## Project Overview
OpenBid is a map-first bidding marketplace platform developed by Team 1: Tyler, Mani, Yanness, Alaister.

## Prerequisites

### Required Software Installation

#### 1. LaTeX Distribution
To compile the project proposal documents, you need a LaTeX distribution installed:

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

#### 2. Make Utility
The project uses a Makefile for automation.

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

#### 3. latexmk (Recommended)
latexmk automates LaTeX document compilation.

**macOS:**
- Included with MacTeX installation via Homebrew
- Verify: `latexmk --version`
- If missing: `sudo tlmgr install latexmk`

## Project Structure
```
.
├── .github/              # Github configuration files
│   ├── pull_request_template.md     # Request template for creating pull requests
├── .vscode/              # VSCode configuration files
│   ├── settings.json    # VSCode latex settings
├── documentation/        # LaTeX documents for 1.1 and 1.2
│   ├── 1.1 Project Proposal/     # LaTeX documents for 1.1
│   │   ├── main.pdf         # Compiled 1.1 PDF output
│   │   └── main.tex         # Main 1.1 LaTeX document
│   ├── 1.2 Detailed User Stories, Requirements, and Initial Prototype/     # LaTeX documents for 1.2
│   │   ├── main.pdf         # Compiled 1.2 PDF output
│   │   ├── main.tex         # Main 1.2 LaTeX document
│   │   ├── UC-1.png        # Manage Jobs UML diagram
│   │   ├── UC-2.png        # Browse & Bid UML diagram
│   │   ├── UC-3.png        # Award & Escrow UML diagram
│   │   └── UC-4.png        # Complete & Payout UML diagram
├── .gitignore           # git ignore
├── Makefile             # Automation scripts
└── README.md           # This file
```

## Usage

### Building the Project Proposal
```bash
# Clean LaTeX compilation artifacts
make clean-latex

# Show available commands
make help
```

### Manual Compilation
```bash
#Create Project Proposal 1.1 as a PDF file
cd "documentation/1.1 Project Proposal" 
pdflatex main.tex

#Create Project Proposal 1.2 as a PDF file
cd "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype" 
pdflatex main.tex
```

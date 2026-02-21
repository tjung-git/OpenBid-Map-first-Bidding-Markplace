# Makefile for OpenBid: Map-first Bidding Marketplace
# Team 1: Tyler, Mani, Yanness, Alaister

.PHONY: help setup latex clean clean-latex dev build test deploy

# Default target
help:
	@echo "OpenBid Makefile Commands:"
	@echo "  make help       - Show this help message"
	@echo "  make clean-latex - Clean LaTeX compilation artifacts"
	
# Clean LaTeX compilation artifacts
clean-latex:
	@echo "Cleaning LaTeX compilation artifacts..."
	@cd "documentation" && latexmk -c 2>/dev/null || true
	@rm -f "documentation/1.1 Project Proposal"/*.aux "documentation/1.1 Project Proposal"/*.fdb_latexmk \
		"documentation/1.1 Project Proposal"/*.fls "documentation/1.1 Project Proposal"/*.log \
		"documentation/1.1 Project Proposal"/*.out "documentation/1.1 Project Proposal"/*.toc \
		"documentation/1.1 Project Proposal"/*.bbl "documentation/1.1 Project Proposal"/*.blg \
		"documentation/1.1 Project Proposal"/*.synctex.gz 2>/dev/null || true

		@rm -f "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.aux "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.fdb_latexmk \
		"documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.fls "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.log \
		"documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.out "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.toc \
		"documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.bbl "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.blg \
		"documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype"/*.synctex.gz 2>/dev/null || true

		@rm -f "documentation/2.1 Testing and Initial Development"/*.aux "documentation/2.1 Testing and Initial Development"/*.fdb_latexmk \
		"documentation/2.1 Testing and Initial Development"/*.fls "documentation/2.1 Testing and Initial Development"/*.log \
		"documentation/2.1 Testing and Initial Development"/*.out "documentation/2.1 Testing and Initial Development"/*.toc \
		"documentation/2.1 Testing and Initial Development"/*.bbl "documentation/2.1 Testing and Initial Development"/*.blg \
		"documentation/2.1 Testing and Initial Development"/*.synctex.gz 2>/dev/null || true

		@rm -f "documentation/2.2 Full Documentation, Prototype, Presentation"/*.aux "documentation/2.2 Full Documentation, Prototype, Presentation"/*.fdb_latexmk \
		"documentation/2.2 Full Documentation, Prototype, Presentation"/*.fls "documentation/2.2 Full Documentation, Prototype, Presentation"/*.log \
		"documentation/2.2 Full Documentation, Prototype, Presentation"/*.out "documentation/2.2 Full Documentation, Prototype, Presentation"/*.toc \
		"documentation/2.2 Full Documentation, Prototype, Presentation"/*.bbl "documentation/2.2 Full Documentation, Prototype, Presentation"/*.blg \
		"documentation/2.2 Full Documentation, Prototype, Presentation"/*.synctex.gz 2>/dev/null || true

		@rm -f "documentation/3.1 Software Design Documentation"/*.aux "documentation/3.1 Software Design Documentation"/*.fdb_latexmk \
		"documentation/3.1 Software Design Documentation"/*.fls "documentation/3.1 Software Design Documentation"/*.log \
		"documentation/3.1 Software Design Documentation"/*.out "documentation/3.1 Software Design Documentation"/*.toc \
		"documentation/3.1 Software Design Documentation"/*.bbl "documentation/3.1 Software Design Documentation"/*.blg \
		"documentation/3.1 Software Design Documentation"/*.synctex.gz 2>/dev/null || true
		
	@echo "LaTeX cleanup complete!"

# Build LaTeX PDFs for documentation sections
.PHONY: latex docs-1.1 docs-1.2 docs-2.1 docs-2.2 docs-3.1
latex: docs-1.1 docs-1.2 docs-2.1 docs-2.2 docs-3.1

docs-1.1:
	@echo "Building 1.1 Project Proposal..."
	@cd "documentation/1.1 Project Proposal" && latexmk -pdf -interaction=nonstopmode -quiet main.tex || true

docs-1.2:
	@echo "Building 1.2 Detailed User Stories..."
	@cd "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype" && latexmk -pdf -interaction=nonstopmode -quiet main.tex || true

docs-2.1:
	@echo "Building 2.1 Testing and Initial Development..."
	@cd "documentation/2.1 Testing and Initial Development" && latexmk -pdf -interaction=nonstopmode -quiet main.tex || true

docs-2.2:
	@echo "Building 2.2 Full Documentation, Prototype, Presentation..."
	@cd "documentation/2.2 Full Documentation, Prototype, Presentation" && latexmk -pdf -interaction=nonstopmode -quiet main.tex || true

docs-3.1:
	@echo "Building 3.1 Software Design Documentation..."
	@cd "documentation/3.1 Software Design Documentation" && latexmk -pdf -interaction=nonstopmode -quiet main.tex || true

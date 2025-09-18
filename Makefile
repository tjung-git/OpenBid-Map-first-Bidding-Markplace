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
		
	@echo "LaTeX cleanup complete!"

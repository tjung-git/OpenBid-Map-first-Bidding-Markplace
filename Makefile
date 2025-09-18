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
	@rm -f "documentation/Project Proposal"/*.aux "documentation/Project Proposal"/*.fdb_latexmk \
		"documentation/Project Proposal"/*.fls "documentation/Project Proposal"/*.log \
		"documentation/Project Proposal"/*.out "documentation/Project Proposal"/*.toc \
		"documentation/Project Proposal"/*.bbl "documentation/Project Proposal"/*.blg \
		"documentation/Project Proposal"/*.synctex.gz 2>/dev/null || true

		@rm -f "documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.aux "documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.fdb_latexmk \
		"documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.fls "documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.log \
		"documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.out "documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.toc \
		"documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.bbl "documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.blg \
		"documentation/Detailed User Stories, Requirements, and Initial Prototype"/*.synctex.gz 2>/dev/null || true
		
	@echo "LaTeX cleanup complete!"

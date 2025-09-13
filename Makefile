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
	@cd "Project Proposal" && latexmk -c 2>/dev/null || true
	@rm -f "Project Proposal"/*.aux "Project Proposal"/*.fdb_latexmk \
		"Project Proposal"/*.fls "Project Proposal"/*.log \
		"Project Proposal"/*.out "Project Proposal"/*.toc \
		"Project Proposal"/*.bbl "Project Proposal"/*.blg \
		"Project Proposal"/*.synctex.gz 2>/dev/null || true
	@echo "LaTeX cleanup complete!"

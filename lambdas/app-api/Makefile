# SAM copies this folder to an isolated build directory; use npm here (not the repo-root pnpm hoists).
.PHONY: build-AppApiFunction
build-AppApiFunction:
	npm ci --no-audit --no-fund
	npx esbuild src/index.ts \
		--bundle \
		--platform=node \
		--target=es2022 \
		--format=cjs \
		--minify \
		--outfile="$(ARTIFACTS_DIR)/index.js"


# Stage 1: Build the application
FROM oven/bun:1 AS builder
ARG BUILDKIT_SBOM_SCAN_CONTEXT=true

WORKDIR /app

# Copy package.json and tsconfig.json.
COPY package.json tsconfig.json ./

# Install dependencies
RUN bun install

# Patch myinvois-client library to match the official LHDN signature template.
# Fixes the PropsDigest inconsistency (stuck-at-Submitted bug) plus Target/Id/SignatureValue
# fields, and subsumes the old XadesQualifyingProperties -> QualifyingProperties rename.
# The script asserts every anchor + guard and exits 1 on any mismatch, so the build fails
# loudly if the library version changes. Must run after `bun install`, before the compile.
# See docs/LHDN-SIGNATURE-SPEC-REFERENCE.md and docs/signature-generation-guide.md.
COPY scripts ./scripts
RUN bun scripts/patch-myinvois.mjs

# Copy the rest of the application source code
COPY src ./src

# Build a standalone Linux binary
RUN bun run build:linux

# Stage 2: Create the final production image
FROM debian:bookworm-slim

WORKDIR /app

# Create a non-root user
RUN useradd -r -s /bin/false appuser \
    && chown -R appuser /app

# Copy the compiled executable from the builder stage
COPY --from=builder /app/bin/myinvois-gateway .

# Copy license and intent files
COPY LICENSE.md INTENT.md ./
COPY README.docker.md README.md

# Switch to non-root user
USER appuser

# Expose the port the application listens on
EXPOSE 3000

# Command to run the application
CMD ["./myinvois-gateway"]

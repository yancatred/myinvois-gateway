# Stage 1: Build the application
FROM oven/bun:1 AS builder
ARG BUILDKIT_SBOM_SCAN_CONTEXT=true

WORKDIR /app

# Copy package.json and tsconfig.json.
COPY package.json tsconfig.json ./

# Install dependencies
RUN bun install

# Patch myinvois-client library: rename XadesQualifyingProperties -> QualifyingProperties
# (library bug: LHDN expects QualifyingProperties per the official SDK sample)
RUN sed -i 's/XadesQualifyingProperties/QualifyingProperties/g' node_modules/myinvois-client/dist/index.js node_modules/myinvois-client/dist/index.mjs

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

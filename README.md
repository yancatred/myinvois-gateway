[![License: LGPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# MyInvois Gateway

## Overview

The MyInvois Gateway handles the submission of new MyInvois documents, significantly simplifying the document submission process compared to interacting directly with the official MyInvois API. Instead of requiring complex, Base64-encoded UBL (XML or JSON), you can submit document data using a developer-friendly, standard JSON structure.

The gateway, powered by the [myinvois-client](https://github.com/farhan-syah/myinvois-client) library, takes care of:

1.  Translating your simple JSON input into the required UBL format.
2.  Calculating document hashes.
3.  Base64 encoding the UBL.
4.  Formatting the request payload for the official API.
5.  Handling document signing.
6.  Supporting caching through Redis (if configured).

Use this gateway to easily submit invoices, credit notes, or debit notes from any application capable of making standard HTTP POST requests with a JSON body.

## Features

- **Simplified Document Submission:** Submit documents using a standard JSON structure instead of complex UBL.
- **Automatic UBL Translation:** Converts JSON input to the required UBL format.
- **Automated Hashing & Encoding:** Handles document hash calculation and Base64 encoding.
- **Official API Formatting:** Prepares the payload for the official MyInvois API.
- **Document Signing:** Manages the document signing process with flexible configuration.
- **Signed Document Retrieval:** `GET /documents/:id/raw` returns the full signed document as stored by MyInvois (the `document` field is a JSON string including the signature block), while `GET /documents/:id` returns metadata only.
- **Optional Redis Caching:** Improves performance and reliability by caching responses.
- **Developer-Friendly API Docs:** Interactive API documentation available via Swagger UI.

The API documentation (Swagger UI) is available at `/docs/api` when the application is running.

## Prerequisites

- **Bun:** For local development and building. (Installation: [https://bun.sh/docs/installation](https://bun.sh/docs/installation))
- **Docker & Docker Compose:** For running the application in containers. (Installation: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/))
- **Git:** For cloning the repository.

## Environment Variables

This application requires the following environment variables:

- `CLIENT_ID`: Your MyInvois Client ID.
- `CLIENT_SECRET`: Your MyInvois Client Secret.
- `GATEWAY_API_KEY` (Optional): An API key you can define to protect access to the gateway. If provided, this key must be sent in the `X-API-KEY` header for all requests to the gateway. If not set, the gateway will be accessible without an API key (not recommended for production or publicly accessible instances).
- `REDIS_URL` (Optional): The connection URL for Redis (e.g., `redis://localhost:6379` for local development, or `redis://redis:6379` when using Docker Compose). If not provided, the application will run without Redis caching.
- `SIGNING_PRIVATE_KEY_PATH` (Optional): Path to a file containing your private key in PKCS#8 PEM format. This is the **highest priority** if set and the file is readable.
- `SIGNING_CERTIFICATE_PATH` (Optional): Path to a file containing your signing certificate's raw DER content, Base64 encoded. This is the **highest priority** if set and the file is readable.
- `SIGNING_PRIVATE_KEY_PEM` (Optional): Your private key in PKCS#8 PEM format (as a string). Used if credentials are not successfully loaded via `SIGNING_PRIVATE_KEY_PATH` or the default path (`certs/private_key.pem`).
- `SIGNING_CERTIFICATE_BASE64` (Optional): Your signing certificate's raw DER content, Base64 encoded (as a string). Used if credentials are not successfully loaded via `SIGNING_CERTIFICATE_PATH` or the default path (`certs/certificate_base64.txt`).

**Setup:**

Create a `.env` file in the root of the project (`myinvois-gateway/.env`) and add your credentials:

```env
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
# GATEWAY_API_KEY=your_gateway_api_key_here # Optional
# REDIS_URL=redis://localhost:6379 # Optional

# --- Document Signing Credentials (e-Invoice v1.1) ---
# The application will attempt to load credentials in the following order:
# 1. Explicit path (SIGNING_PRIVATE_KEY_PATH, SIGNING_CERTIFICATE_PATH)
# 2. Default path (./certs/private_key.pem, ./certs/certificate_base64.txt)
# 3. Direct content (SIGNING_PRIVATE_KEY_PEM, SIGNING_CERTIFICATE_BASE64)
# If none are found, signing will be unavailable.

# Option 1: Specify explicit paths to your credential files (Highest Priority)
# SIGNING_PRIVATE_KEY_PATH="/custom/path/to/your_private_key.pem"
# SIGNING_CERTIFICATE_PATH="/custom/path/to/your_certificate_base64.txt"

# Option 2: Use default paths by placing files in a 'certs' directory
# (No need to set _PATH variables if using these exact relative paths from project root)
# Create a 'certs' directory in 'myinvois-gateway/'
# - myinvois-gateway/certs/private_key.pem
# - myinvois-gateway/certs/certificate_base64.txt
# The application will automatically check these locations if SIGNING_PRIVATE_KEY_PATH 
# and SIGNING_CERTIFICATE_PATH are not set or if their specified files are not found.

# Option 3: Provide credential content directly as environment variables (Fallback)
# SIGNING_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...your PKCS#8 private key content...\n-----END PRIVATE KEY-----"
# SIGNING_CERTIFICATE_BASE64="your_certificate_raw_der_base64_content"
```

This `.env` file will be automatically used by `bun run dev`, when running the compiled binary locally (if your application loads it, typically via a library like `dotenv` which Bun might handle implicitly for `process.env`), and by Docker Compose if it's in the same directory.

## Document Signing Configuration

To enable document signing (required for e-Invoice v1.1), you need to provide your private key and signing certificate. The gateway loads these credentials with the following precedence:

1.  **Explicit File Paths:** By setting the `SIGNING_PRIVATE_KEY_PATH` and `SIGNING_CERTIFICATE_PATH` environment variables to the locations of your credential files.
    -   The file at `SIGNING_PRIVATE_KEY_PATH` should contain the PKCS#8 PEM private key.
    -   The file at `SIGNING_CERTIFICATE_PATH` should contain the Base64 encoded raw DER content of your certificate.
2.  **Default File Paths:** If the explicit path variables are not set or the specified files are not found, the gateway will automatically look for credentials at these default locations relative to the project root:
    -   Private Key: `certs/private_key.pem`
    -   Certificate: `certs/certificate_base64.txt`
    You can create a `certs` directory in your project root (`myinvois-gateway/certs/`) and place your files there with these names.
3.  **Direct Environment Variable Content:** If credentials are not found through file paths (neither explicit nor default), the gateway will attempt to use the content directly from:
    -   `SIGNING_PRIVATE_KEY_PEM`: The full PKCS#8 PEM private key string.
    -   `SIGNING_CERTIFICATE_BASE64`: The Base64 encoded raw DER content of your certificate.

If credentials are not successfully loaded by any of these methods, the respective configuration values will be `undefined`. In this case, document signing capabilities will be unavailable, and a warning will be logged by the application during startup. Attempting a signing operation without fully configured credentials will result in an error.

Detailed instructions on how to prepare your credentials (e.g., format requirements, converting from `.p12` files) can be found in:

- [instructions/adding_signature.md](instructions/adding_signature.md)

Please refer to this file for guidance on preparing your key and certificate content.

## Running the Application

You can run the application in several ways:

### 1. Local Development (using Bun)

This method uses Bun to run the application directly from the source code with hot-reloading.

1.  **Install dependencies:**
    ```bash
    bun install
    ```
2.  **Set environment variables:** Ensure your `.env` file in the project root is configured (see "Environment Variables" section), or set the environment variables directly in your shell. If using local Redis, make sure `REDIS_URL` points to it (e.g., `redis://localhost:6379`). For signing, ensure your key and certificate files are in place (e.g., in `myinvois-gateway/certs/`) if using default paths, or that the appropriate environment variables are set.
3.  **Run the development server:**
    ```bash
    bun run dev
    ```
    The application will typically be available at `http://localhost:3000`.

### 2. Local Production Run (Using Released Binary)

This method uses the pre-built, released binary. **Recommended:** Download the latest zip from the [GitHub Releases page](https://github.com/farhan-syah/myinvois-gateway/releases). You do not need to build from source unless you want a custom build.

1.  **Download and extract the release zip:**
    - Go to the [GitHub Releases page](https://github.com/farhan-syah/myinvois-gateway/releases) and download the appropriate zip for your platform (e.g., `myinvois-gateway-linux-v1.0.0.zip`).
    - Extract it to your desired location:
      ```bash
      unzip myinvois-gateway-linux-v1.0.0.zip -d myinvois-gateway-bin
      cd myinvois-gateway-bin
      ```
    - If you built from source, you can also find the zip in the local `release/` folder after running the packaging script.
2.  **Set environment variables:**
    - Ensure your `.env` file is present in the extracted directory (or set environment variables in your shell). For signing, ensure your key and certificate files are accessible (e.g., in a `certs` directory alongside the binary if using default paths, or use absolute paths in environment variables).
3.  **Run the executable:**
    - On Linux:
      ```bash
      ./myinvois-gateway
      ```
    - On Windows, run `myinvois-gateway.exe`.
    - The application will be available at `http://localhost:3000`.

> See the included `README.txt` in the extracted folder for any release-specific notes.

### 3. Using Docker

This method involves running the application as a Docker container.

**Option A: Pull from Docker Hub (Recommended for quick start)**

```bash
docker pull farhansyah/myinvois-gateway
```
Then, skip to step 2 (Run the Docker container), ensuring you use `farhansyah/myinvois-gateway` as the image name.

**Option B: Build the Docker image locally**

1.  **Build the Docker image:** From the project root (`myinvois-gateway/`), run:
    ```bash
    docker build -t myinvois-gateway .
    ```

2.  **Run the Docker container:**
    When running the Docker container, you can provide signing credentials by:
    - Mounting files/directories into the container and setting `SIGNING_PRIVATE_KEY_PATH` and `SIGNING_CERTIFICATE_PATH` to their paths *within the container*.
    - Mounting a `certs` directory to `/app/certs` (or `certs/` if WORKDIR is `/app`) inside the container to use the default paths.
    - Setting `SIGNING_PRIVATE_KEY_PEM` and `SIGNING_CERTIFICATE_BASE64` directly.

    #### Example (Using Default Paths by Mounting a `certs` Directory):
    ```bash
    # Assume you have ./my-local-certs/private_key.pem and ./my-local-certs/certificate_base64.txt on your host.
    docker run -d \
      -e CLIENT_ID="your_client_id_here" \
      -e CLIENT_SECRET="your_client_secret_here" \
      # -e GATEWAY_API_KEY="your_gateway_api_key_here" \ # Optional
      # -e REDIS_URL="redis://<your_redis_host>:<your_redis_port>" \ # Optional
      -v ./my-local-certs:/app/certs:ro \ # Mounts host's ./my-local-certs to /app/certs in container
      -p 3000:3000 \
      --name myinvois_gateway \
      myinvois-gateway # or farhansyah/myinvois-gateway
    ```
    *In this example, the application will look for `/app/certs/private_key.pem` and `/app/certs/certificate_base64.txt` by default.*

    #### Example (Using Explicit Paths with Volume Mounts):
    ```bash
    docker run -d \
      -e CLIENT_ID="your_client_id_here" \
      -e CLIENT_SECRET="your_client_secret_here" \
      -e SIGNING_PRIVATE_KEY_PATH="/etc/secrets/my_private_key.pem" \
      -e SIGNING_CERTIFICATE_PATH="/etc/secrets/my_certificate_base64.txt" \
      -v /path/on/host/to/your_private_key.pem:/etc/secrets/my_private_key.pem:ro \
      -v /path/on/host/to/your_certificate_base64.txt:/etc/secrets/my_certificate_base64.txt:ro \
      -p 3000:3000 \
      --name myinvois_gateway \
      myinvois-gateway # or farhansyah/myinvois-gateway
    ```

    - Replace placeholder values. The `:ro` makes the mounts read-only.
    - Access the application at `http://localhost:3000`.

### 4. Using Docker Compose

This is a recommended method for a consistent environment.

1.  **Ensure Docker Compose is installed.**
2.  **Create/Verify `.env` file:** (See "Environment Variables" section).
    If using default file paths for signing (`certs/...`), you'll need to configure `docker-compose.yml` to mount your local `certs` directory into the service.
    Example `docker-compose.yml` snippet for mounting a local `certs` directory:
    ```yaml
    # In your docker-compose.yml
    services:
      app:
        # ... other app configurations
        # environment: # .env file usually takes precedence for these if SIGNING...PATH not set
        #   SIGNING_PRIVATE_KEY_PATH: /app/certs/private_key.pem # Optional if using default
        #   SIGNING_CERTIFICATE_PATH: /app/certs/certificate_base64.txt # Optional if using default
        volumes:
          - ./certs:/app/certs:ro # Mounts local ./certs to /app/certs in container
          # Add other volumes as needed
    ```
    *Make sure your local `./certs` directory (relative to `docker-compose.yml`) contains `private_key.pem` and `certificate_base64.txt`.*
    If you set `SIGNING_PRIVATE_KEY_PATH` or `SIGNING_CERTIFICATE_PATH` in your `.env` file, those paths must be valid *inside the container* and you must ensure the files are mounted to those specific locations.

3.  **Run Docker Compose:**
    From the project root (`myinvois-gateway/`):
    ```bash
    docker compose up --build -d
    ```
    The application will be available at `http://localhost:3000`.

4.  **Stopping Docker Compose:**
    ```bash
    docker compose down
    ```

## API Documentation

Once the application is running, API documentation (Swagger UI) can be accessed at:

`http://localhost:3000/docs/api`

![2025-06-10_18-43](https://github.com/user-attachments/assets/de187a81-d409-4980-a88b-13e4e3d35f51)

### API Key Security and Usage

The `GATEWAY_API_KEY` is **optional**. If you choose to set one, it is used to protect your MyInvois Gateway instance from unauthorized access. If it's not set, the gateway will operate without API key authentication. **This is not recommended for production environments unless access is strictly controlled by other means (e.g., firewall, VPC).**

**Security Best Practices (When Using `GATEWAY_API_KEY`):**
- **Strong, Unique Key:** Generate using tools like `openssl rand -hex 32`.
- **Environment Variables:** Always provide via an environment variable. Do not hardcode.
- **Limit Exposure:** Only provide to trusted client applications.

## License

This project is licensed under the GNU General Public License v3.0.
A copy of the license is included in the `LICENSE.md` file.
The canonical source code for MyInvois Gateway is available at:
[myinvois-gateway](https://github.com/farhan-syah/myinvois-gateway)

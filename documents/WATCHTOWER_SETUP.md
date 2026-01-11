# Watchtower Setup for Automatic Container Updates

This guide explains how to set up Watchtower to automatically pull and restart the `cycle-navigator-dashboard` containers when new images are pushed to GitHub Container Registry (GHCR).

---

## Overview

**Watchtower** monitors running containers and checks for updated images in the registry. When a new image is detected, it:
1. Pulls the new image
2. Gracefully stops the running container
3. Restarts the container with the new image (preserving run options)

This enables a hands-free deployment workflow: push to `develop` → CI builds & pushes to GHCR → Watchtower detects & deploys locally.

---

## Prerequisites

- Docker or Podman installed on your local machine
- Access to GHCR (GitHub Container Registry)
- A GitHub Personal Access Token (PAT) with `read:packages` scope (for private repos)

---

## Create a GitHub Personal Access Token (PAT)

If your GHCR image is private, generate a PAT with `read:packages`:

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give a descriptive name (e.g., `watchtower-ghcr-read`)
4. Select scope: `read:packages`
5. Click **Generate token** and copy it securely

---

## Login to GHCR

### Docker:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Podman:
```bash
echo "YOUR_GITHUB_PAT" | podman login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

---

## Running the Application with Docker Compose

The recommended way to run the application is with Docker Compose, which manages both services:

```bash
# Start both backend and frontend services
docker-compose up -d

# Or pull images from GHCR and run
docker-compose pull
docker-compose up -d
```

This creates two containers:
- `cycle-navigator-backend` - FastAPI service on port 8000
- `cycle-navigator-web` - Next.js service on port 3000

---

## Run Watchtower

### Monitor Docker Compose Containers

Watchtower can monitor the containers created by docker-compose:

#### Docker:
```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped \
  containrrr/watchtower cycle-navigator-backend cycle-navigator-web
```

#### Podman:
```bash
# Enable the Podman socket (user-level) if not already running
systemctl --user enable --now podman.socket

# Run Watchtower
podman run -d \
  --name watchtower \
  -v /run/user/$(id -u)/podman/podman.sock:/var/run/docker.sock \
  -v ~/.config/containers/auth.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped \
  docker.io/containrrr/watchtower cycle-navigator-backend cycle-navigator-frontend
```

---

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `WATCHTOWER_POLL_INTERVAL` | Seconds between update checks | `86400` (24h) |
| `WATCHTOWER_CLEANUP` | Remove old images after update | `false` |
| `WATCHTOWER_INCLUDE_STOPPED` | Also update stopped containers | `false` |
| `WATCHTOWER_INCLUDE_RESTARTING` | Include restarting containers | `false` |
| `WATCHTOWER_DEBUG` | Enable debug logging | `false` |

---

## Verify Watchtower Is Running

Check Watchtower logs:

```bash
# Docker
docker logs watchtower

# Podman
podman logs watchtower
```

You should see output like:
```
time="2025-12-09T10:00:00Z" level=info msg="Watchtower 1.7.1"
time="2025-12-09T10:00:00Z" level=info msg="Checking for updates..."
```

---

## Complete Workflow

1. **Developer** pushes code to `develop` branch
2. **GitHub Actions CI** runs lint, tests, builds containers, pushes to GHCR
3. **Watchtower** (on local machine) polls GHCR every 5 minutes (configurable)
4. **Watchtower** detects new images, pulls them, restarts containers
5. **Application** is now running the latest version automatically

---

## Troubleshooting

### Watchtower not detecting updates

1. Verify container names: `docker ps` should show `cycle-navigator-backend` and `cycle-navigator-frontend`
2. Check Watchtower logs: `docker logs watchtower`
3. Ensure GHCR credentials are correct

### Authentication errors

1. Re-login to GHCR: `docker login ghcr.io`
2. Verify config file exists: `cat ~/.docker/config.json`
3. Ensure PAT has `read:packages` scope

### Podman socket issues

```bash
# Check if socket is running
systemctl --user status podman.socket

# Restart if needed
systemctl --user restart podman.socket
```

---

## Alternative: Podman Auto-Update (Native)

Podman has built-in auto-update functionality without Watchtower:

```bash
# Run containers with auto-update label
podman run -d \
  --name cycle-navigator-backend \
  --label io.containers.autoupdate=registry \
  -p 8000:8000 \
  ghcr.io/chucks007/cycle-navigator-dashboard-backend:latest

podman run -d \
  --name cycle-navigator-frontend \
  --label io.containers.autoupdate=registry \
  -p 8501:8501 \
  ghcr.io/chucks007/cycle-navigator-dashboard-frontend:latest

# Enable the systemd timer for auto-updates
systemctl --user enable --now podman-auto-update.timer

# Manually trigger an update check
podman auto-update
```

---

## Quick Start Commands

### Docker:
```bash
# 1. Login to GHCR
echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 2. Start the application with docker-compose
docker-compose up -d

# 3. Start Watchtower
docker run -d --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped containrrr/watchtower \
  cycle-navigator-backend cycle-navigator-frontend

# 4. Verify
docker logs watchtower
```

### Podman:
```bash
# 1. Login to GHCR
echo "YOUR_PAT" | podman login ghcr.io -u YOUR_USERNAME --password-stdin

# 2. Start the application with podman-compose
podman-compose up -d

# 3. Enable Podman socket and start Watchtower
systemctl --user enable --now podman.socket
podman run -d --name watchtower \
  -v /run/user/$(id -u)/podman/podman.sock:/var/run/docker.sock \
  -v ~/.config/containers/auth.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped docker.io/containrrr/watchtower \
  cycle-navigator-backend cycle-navigator-frontend

# 4. Verify
podman logs watchtower
```

You're now set up for automated deployments! 🚀

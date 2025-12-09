# Watchtower Setup for Automatic Container Updates

This guide explains how to set up [Watchtower](https://containrrr.dev/watchtower/) to automatically pull and restart the `cycle-navigator-dashboard` container when new images are pushed to GitHub Container Registry (GHCR).

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

## Step 1: Create a GitHub Personal Access Token (if needed)

If your GHCR image is **private**, you need a PAT to authenticate:

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g., `watchtower-ghcr-read`)
4. Select scope: `read:packages`
5. Click **Generate token** and copy it securely

> **Note:** If your GHCR package is public, you can skip authentication, but Watchtower still benefits from auth to avoid rate limits.

---

## Step 2: Log in to GHCR on Your Local Machine

### Docker:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Podman:
```bash
echo "YOUR_GITHUB_PAT" | podman login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

This stores credentials in `~/.docker/config.json` (Docker) or Podman's auth file, which Watchtower can use.

---

## Step 3: Run the Cycle Navigator Dashboard Container

Start your application container with a name Watchtower can monitor:

### Docker:
```bash
docker run -d \
  --name cycle-navigator-app \
  -p 8501:8501 \
  -p 8000:8000 \
  -e FRED_API_KEY=your_fred_api_key \
  --restart unless-stopped \
  ghcr.io/chucks007/cycle-navigator-dashboard:latest
```

### Podman:
```bash
podman run -d \
  --name cycle-navigator-app \
  -p 8501:8501 \
  -p 8000:8000 \
  -e FRED_API_KEY=your_fred_api_key \
  --restart unless-stopped \
  ghcr.io/chucks007/cycle-navigator-dashboard:latest
```

---

## Step 4: Run Watchtower

### Option A: Monitor All Containers

Run Watchtower to monitor **all** running containers:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  --restart unless-stopped \
  containrrr/watchtower
```

### Option B: Monitor Only Specific Containers (Recommended)

Monitor only the `cycle-navigator-app` container:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  --restart unless-stopped \
  containrrr/watchtower cycle-navigator-app
```

### Podman Equivalent:

For Podman, you need to enable the Podman socket first:

```bash
# Enable and start the Podman socket (user-level)
systemctl --user enable --now podman.socket

# Run Watchtower with Podman socket
podman run -d \
  --name watchtower \
  -v /run/user/$(id -u)/podman/podman.sock:/var/run/docker.sock \
  -v ~/.config/containers/auth.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  --restart unless-stopped \
  docker.io/containrrr/watchtower cycle-navigator-app
```

---

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `WATCHTOWER_POLL_INTERVAL` | Seconds between update checks | `86400` (24h) |
| `WATCHTOWER_CLEANUP` | Remove old images after update | `false` |
| `WATCHTOWER_INCLUDE_STOPPED` | Also update stopped containers | `false` |
| `WATCHTOWER_NOTIFICATIONS` | Enable notifications (email, Slack, etc.) | — |
| `WATCHTOWER_DEBUG` | Enable debug logging | `false` |

### Recommended Production Settings:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  -e WATCHTOWER_INCLUDE_RESTARTING=true \
  --restart unless-stopped \
  containrrr/watchtower cycle-navigator-app
```

---

## Step 5: Verify Watchtower Is Running

Check Watchtower logs:

```bash
docker logs watchtower
```

You should see output like:
```
time="2025-12-09T10:00:00Z" level=info msg="Watchtower 1.7.1"
time="2025-12-09T10:00:00Z" level=info msg="Using notifications: none"
time="2025-12-09T10:00:00Z" level=info msg="Checking for updates..."
time="2025-12-09T10:00:05Z" level=info msg="Found new ghcr.io/chucks007/cycle-navigator-dashboard:latest image"
```

---

## Complete Workflow

1. **Developer** pushes code to `develop` branch
2. **GitHub Actions CI** runs lint, tests, builds container, pushes to GHCR with `latest` + SHA tags
3. **Watchtower** (on local machine) polls GHCR every 5 minutes (configurable)
4. **Watchtower** detects new `latest` image, pulls it, restarts `cycle-navigator-app`
5. **Application** is now running the latest version automatically

---

## Troubleshooting

### Watchtower not detecting updates

1. Verify the image tag matches: `ghcr.io/chucks007/cycle-navigator-dashboard:latest`
2. Check Watchtower logs: `docker logs watchtower`
3. Ensure GHCR credentials are correct: `docker pull ghcr.io/chucks007/cycle-navigator-dashboard:latest`

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
# Run container with auto-update label
podman run -d \
  --name cycle-navigator-app \
  --label io.containers.autoupdate=registry \
  -p 8501:8501 \
  -p 8000:8000 \
  -e FRED_API_KEY=your_fred_api_key \
  ghcr.io/chucks007/cycle-navigator-dashboard:latest

# Enable the systemd timer for auto-updates
systemctl --user enable --now podman-auto-update.timer

# Check update schedule
systemctl --user list-timers podman-auto-update.timer

# Manually trigger an update check
podman auto-update
```

This is a simpler alternative if you're using Podman exclusively.

---

## Security Considerations

- Store GitHub PAT securely (consider using a secrets manager)
- Use `read:packages` scope only (least privilege)
- Run Watchtower with limited container access if monitoring specific containers
- Consider network isolation for the application container

---

## Quick Start Commands

```bash
# 1. Login to GHCR
echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 2. Start the application
docker run -d --name cycle-navigator-app -p 8501:8501 -p 8000:8000 \
  -e FRED_API_KEY=your_key --restart unless-stopped \
  ghcr.io/chucks007/cycle-navigator-dashboard:latest

# 3. Start Watchtower
docker run -d --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 -e WATCHTOWER_CLEANUP=true \
  --restart unless-stopped containrrr/watchtower cycle-navigator-app

# 4. Verify
docker logs watchtower
```

You're now set up for automated deployments! 🚀

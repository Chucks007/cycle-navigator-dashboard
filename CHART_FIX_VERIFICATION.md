# Chart Interaction & TradingView Fix - Verification Checklist

## ✅ Completed Changes

### 1. web/Dockerfile
- ✅ Added `ARG NEXT_PUBLIC_API_URL=http://backend:8000` to builder stage
- ✅ Added `ARG BACKEND_URL=http://backend:8000` to builder stage  
- ✅ Added `ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}` to builder stage
- ✅ Added `ENV BACKEND_URL=${BACKEND_URL}` to builder stage
- ✅ Added matching ARG/ENV to runner stage for runtime access

### 2. docker-compose.yml
- ✅ Added `build.args` section to web service with:
  - `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://backend:8000}`
  - `BACKEND_URL: ${BACKEND_URL:-http://backend:8000}`
- ✅ Updated `environment` section with proper defaults

---

## 🔧 Verification Steps

### Step 1: Rebuild Frontend Image (No Cache)

```bash
# Using docker-compose
docker-compose build --no-cache web
docker-compose up -d --force-recreate web backend

# OR using podman-compose
podman-compose build --no-cache web
podman-compose up -d --force-recreate web backend
```

**Expected:** Build logs should show the ARG values being passed and used during the Next.js build process.

---

### Step 2: Verify Build-Time Inlined URL

```bash
# Check if the correct API URL was baked into the bundle
docker-compose exec web sh -c "grep -r 'http://backend:8000' /app/.next/static 2>/dev/null | head -5"

# OR with podman
podman exec -it cycle-navigator-web sh -c "grep -r 'http://backend:8000' /app/.next/static 2>/dev/null | head -5"
```

**Expected:** Should find references to `http://backend:8000` in the built JavaScript bundles (not `undefined` or `http://localhost:8000`).

---

### Step 3: Initialize Database & Populate Cache

```bash
# Run the init script inside the backend container
docker-compose exec backend python scripts/init_db.py

# OR with podman
podman exec -it cycle-navigator-backend python scripts/init_db.py
```

**Expected:** Script should create tables and fetch initial data. Charts may show "No Data" if this step is skipped.

---

### Step 4: Verify Backend Health & API Connectivity

```bash
# Test backend directly
curl -v http://localhost:8000/health

# Test through Next.js proxy (if rewrites are configured)
curl -v http://localhost:3000/api/health
```

**Expected:** Both should return HTTP 200 with valid JSON responses.

---

### Step 5: Browser DevTools Verification

1. Open browser and navigate to: `http://localhost:3000`
2. Open DevTools (F12) → **Network** tab
3. Reload the page
4. Look for API requests:
   - Requests should target `http://backend:8000/...` (or be proxied via `/api/...`)
   - **NOT** `undefined/...` or `http://localhost:8000/...` (from browser's perspective, localhost:8000 would be the user's machine, not the backend container)
5. Check Status column: Should show **200 OK** with valid JSON responses
6. Check Console tab: Should have **no CORS errors** or "Failed to fetch" errors

**Expected:** All API calls succeed and return data.

---

### Step 6: Verify Chart Rendering & Interactions

#### A. Charts Load with Data
- Navigate to dashboard sections with charts (Macro, Stocks, Crypto, etc.)
- **Expected:** Charts render with actual data (not "Error Loading Data" or blank)

#### B. Crosshair & Hover Interactions
- Hover mouse over a chart
- **Expected:** Crosshair appears with legend overlay showing values

#### C. Chart Resize
- Resize browser window
- **Expected:** Charts update their dimensions responsively

#### D. Expandable Chart Modal
- Click on a chart card (ExpandableChartCard)
- **Expected:** Modal/expanded view opens with detailed chart
- Verify interactions work in expanded mode (hover, zoom, etc.)

#### E. TradingView/Lightweight Charts Rendering
- Specifically check for candlestick charts or time-series charts
- **Expected:** Charts render with proper styling and interactive elements

---

## 🐛 Troubleshooting

### Issue: API URL still shows `undefined` or `localhost:8000` in browser network requests

**Solution:**
1. Ensure you rebuilt with `--no-cache`:
   ```bash
   docker-compose build --no-cache web
   ```
2. Clear old images:
   ```bash
   docker-compose down --rmi all
   docker-compose build --no-cache
   docker-compose up -d
   ```
3. Check that `build.args` is present in docker-compose.yml (Step 2 above)

---

### Issue: Charts show "Error Loading Data" or "No Data"

**Solutions:**
1. Run database initialization:
   ```bash
   docker-compose exec backend python scripts/init_db.py
   ```
2. Check backend logs for errors:
   ```bash
   docker-compose logs -f backend
   ```
3. Verify backend is healthy:
   ```bash
   curl http://localhost:8000/health
   ```
4. Check if FRED_API_KEY is set (for macro data):
   ```bash
   docker-compose exec backend printenv | grep FRED
   ```

---

### Issue: CORS errors in browser console

**Solution:**
- Ensure BACKEND_URL and NEXT_PUBLIC_API_URL both point to `http://backend:8000` (internal container network), not `localhost:8000`
- Check Next.js rewrites configuration in `next.config.ts` uses the correct BACKEND_URL

---

### Issue: Port mismatch errors

**Solution:**
- Verify backend is mapped to port 8000 in docker-compose.yml:
  ```yaml
  backend:
    ports:
      - "8000:8000"
  ```
- If using a different port, update the build args in docker-compose.yml accordingly

---

## 🎯 Success Criteria

- [x] Web Dockerfile has build-time ARG/ENV for NEXT_PUBLIC_API_URL and BACKEND_URL
- [x] docker-compose.yml passes build args to web service
- [ ] Frontend rebuilds successfully with --no-cache
- [ ] Built bundle contains `http://backend:8000` (not undefined)
- [ ] Database initialized with data
- [ ] Backend responds to health checks
- [ ] Browser network requests show API calls to correct URL
- [ ] Charts render with data
- [ ] Chart interactions work (hover, expand, resize)
- [ ] TradingView/Lightweight charts display correctly
- [ ] No console errors related to API or CORS

---

## 📝 Additional Notes

### CI/CD Considerations
If you build images in CI/CD pipelines, ensure build args are passed:

```bash
# Docker CLI example
docker build \
  --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  --build-arg BACKEND_URL=$BACKEND_URL \
  -t myorg/cycle-navigator-web:latest \
  web/
```

### Production Deployment
For production deployments, override the default URLs via environment variables:

```bash
# Example: .env file
NEXT_PUBLIC_API_URL=https://api.production.example.com
BACKEND_URL=https://api.production.example.com
```

Then rebuild:
```bash
docker-compose build --no-cache web
docker-compose up -d
```

---

## 🔍 Logs to Monitor

```bash
# Web container logs
docker-compose logs -f web

# Backend container logs
docker-compose logs -f backend

# All services
docker-compose logs -f
```

---

## ✨ Root Cause Summary

The issue occurred because Next.js requires `NEXT_PUBLIC_*` environment variables to be available **at build time** to inline them into the client-side JavaScript bundle. Previously:

1. ❌ `web/Dockerfile` did NOT declare `ARG` or `ENV` for `NEXT_PUBLIC_API_URL` before `npm run build`
2. ❌ `docker-compose.yml` did NOT pass build args to the web service
3. ❌ Result: Built bundle contained default/fallback values (`undefined` or `localhost:8000`)
4. ❌ When accessed from browser, API calls failed → charts couldn't load data → non-interactive/empty charts

**Fix:** Added build-time ARG/ENV injection so the correct API URL is baked into the production bundle during `docker build`.

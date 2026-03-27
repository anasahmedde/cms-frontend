# CMS Frontend

A React-based admin dashboard for the Digix CMS platform — managing devices, videos, content approvals, grid layouts, announcements, and real-time monitoring.

## Overview

The frontend provides a full-featured admin UI for operators to:

- **Manage Devices** — register, monitor, configure, activate/deactivate IoT/Android devices
- **Upload Content** — upload videos and images to AWS S3 with metadata configuration
- **Organize Groups & Shops** — group devices for bulk content assignments
- **Link Content** — associate devices/groups with videos via direct link or approval workflow
- **Grid Layout Editor** — visually assign videos to multi-screen grid slots with drag-and-drop
- **Sequential Playback** — configure ordered video playlists for single-screen devices
- **Content Approval Queue** — review and approve/reject content change requests
- **Announcements** — create and schedule global or targeted announcements
- **Reports & Uptime** — temperature logs, uptime tracking, storage usage, CSV exports
- **Real-time Updates** — WebSocket-powered pending approval badge and announcement banners

---

## Features

### Recent Links Dashboard
Central view showing all device-video links with:
- Live online/offline status per device
- Temperature and daily/monthly play counters
- Grid layout badge showing slot assignments
- ▶️ Play button — preview device content in a modal with correct grid positioning
- 📐 Grid button — open the Grid Layout Editor
- ✏️ Content button — edit assigned videos directly

### Grid Layout Editor
Visual drag-and-drop editor for multi-screen layouts:
- **Layouts**: Single, 2 Horizontal, 2 Vertical, 3 Videos, 4 Grid (2×2), 4 Grid (1×4)
- Drag videos and images into slots
- Per-slot rotation (0°/90°/180°/270°) and fit mode
- Empty slots are preserved on save and reopen
- Videos are placed at their correct grid position (not packed left)
- **Apply to Group** — push the same layout to all devices in the group

### Sequential Playback (Single Screen)
When the single layout is selected, a **"Play all videos in sequence"** toggle appears:
- **OFF** (default): only the one assigned video plays, looping
- **ON**: select which group videos to include and drag to set playback order; the device plays them in sequence, looping forever
- Persists per device and syncs to the whole group via Apply to Group

### Content Approval Workflow
- Users submit content change requests (link/assign/remove) with optional notes
- Admins review in the Approval Queue with media previews
- Approving immediately syncs `device_video_shop_group` and refreshes Recent Links
- Pending count badge updates in real-time via WebSocket (no polling)

### Announcements
- Create global or device-targeted announcements
- Schedule start/end times with optional expiration
- Banner displayed to all connected admin sessions in real-time

---

## Tech Stack

- **React 19** — UI framework
- **Axios** — HTTP client
- **WebSocket** (native browser API) — real-time updates
- **CSS-in-JS** (inline styles) — component styling

---

## Project Structure

```
src/
├── api/                          # API client modules
│   ├── config.js                 # Base URL configuration
│   ├── device.js                 # Device API calls
│   ├── video.js                  # Video API calls
│   ├── shop.js                   # Shop API calls
│   ├── group.js                  # Group API calls
│   ├── link.js                   # Link API calls
│   └── dvsg.js                   # Combined service API calls
├── components/
│   ├── RecentLinks.js            # Main dashboard + VideoPlayerModal
│   ├── GridLayoutEditor.js       # Grid layout drag-and-drop editor
│   ├── ContentApprovalQueue.jsx  # Approval review UI
│   ├── GroupLinkedVideo.js       # Group video assignment + approval submit
│   ├── Device.js                 # Device management
│   ├── Video.js                  # Video upload and management
│   ├── Shop.js                   # Shop management
│   ├── Group.js                  # Group management
│   ├── Advertisement.js          # Image/ad management
│   ├── Reports.js                # Analytics and logs
│   ├── GlobalAnnouncementBanner.jsx  # Announcement display
│   ├── ExpirationNotificationBanner.jsx # Expiry warnings
│   ├── PlatformAdmin.js          # Platform-level admin tools
│   └── PlatformDashboard.js      # Platform overview
└── App.js                        # Root component, routing, WebSocket setup
```

---

## Installation

### Prerequisites
- Node.js 18+ (LTS recommended)
- CMS Backend running on port 8005

### Setup

```bash
git clone <repository-url>
cd cms-frontend

npm install
```

### Environment Variables

Create a `.env` file:

```env
REACT_APP_API_BASE_URL=http://localhost:8005
REACT_APP_API_GROUP_BASEURL=http://localhost:8005
REACT_APP_API_SHOP_BASEURL=http://localhost:8005
REACT_APP_API_VIDEO_BASEURL=http://localhost:8005
REACT_APP_API_LINK_BASEURL=http://localhost:8005
REACT_APP_API_DEVICE_BASEURL=http://localhost:8005
REACT_APP_API_DVSG_BASEURL=http://localhost:8005
```

### Run

```bash
npm start        # Development server at http://localhost:3000
npm run build    # Production build → build/
```

---

## Deployment

CI/CD is configured via `.github/workflows/deploy-frontend.yml`. Pushes to `staging` trigger automatic deployment.

Serve the `build/` folder with any static file server or CDN (nginx, S3+CloudFront, Vercel, Netlify).

Example nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/cms-frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `staging` | Main integration branch — all PRs target here |
| `main` | Production-stable |
| `fix/*` | Bug fix branches |
| `feat/*` | Feature branches |

---

## Troubleshooting

**CORS errors** — ensure backend has CORS enabled for the frontend origin.

**Videos not loading in preview** — check S3 presigned URL expiration and bucket permissions.

**WebSocket not connecting** — verify `REACT_APP_API_BASE_URL` points to the correct backend host and the WS endpoint is reachable.

**Approval badge not updating** — the badge uses WebSocket push; check the WS connection in browser DevTools → Network → WS.

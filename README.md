# DGX Frontend

A React-based admin dashboard for managing devices, videos, shops, and groups. Built with React 19 and Material-UI.

## Overview

This frontend application provides a user-friendly interface for the DGX backend system, enabling administrators to:

- **Manage Devices** - Register, monitor, and configure IoT/mobile devices
- **Upload Videos** - Upload and manage video content stored on AWS S3
- **Organize Shops** - Create and manage shop/location entities
- **Create Groups** - Group devices for bulk video assignments
- **Link Resources** - Associate devices with videos, shops, and groups
- **View Reports** - Monitor device status, temperature logs, and activity

## Features

- 📱 **Device Management** - Real-time online status, temperature monitoring, daily/monthly counters
- 🎬 **Video Management** - Upload videos, configure rotation, fit mode, and display duration
- 🏪 **Shop Management** - Create and organize shop locations
- 👥 **Group Management** - Bulk assign videos to device groups
- 🔗 **Link Management** - Visual interface for device-video-shop-group associations
- 📊 **Reports & Logs** - Temperature reports, activity logs, CSV exports

## Tech Stack

- **React 19** - UI Framework
- **Material-UI (MUI) 7** - Component Library
- **Axios** - HTTP Client
- **Lucide React** - Icon Library
- **Emotion** - CSS-in-JS Styling

## Project Structure

```
src/
├── api/                    # API client modules
│   ├── config.js          # API endpoint configuration
│   ├── httpFactory.js     # Axios instance factory
│   ├── device.js          # Device API calls
│   ├── video.js           # Video API calls
│   ├── shop.js            # Shop API calls
│   ├── group.js           # Group API calls
│   ├── link.js            # Link API calls
│   ├── dvsg.js            # Combined service API calls
│   └── paginate.js        # Pagination utilities
├── components/             # React components
│   ├── Device.js          # Device management UI
│   ├── Video.js           # Video management UI
│   ├── Shop.js            # Shop management UI
│   ├── Group.js           # Group management UI
│   ├── Linker.js          # Resource linking UI
│   ├── RecentLinks.js     # Links display component
│   ├── GroupLinkedVideo.js # Group video assignments
│   ├── Reports.js         # Reports and analytics
│   └── TemperatureReportModal.jsx # Temperature details
├── App.jsx                 # Main application component
├── App.js                  # Alternative app entry
├── index.js               # React entry point
└── index.css              # Global styles
```

## Installation

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- DGX Backend services running

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dgx-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:
   ```env
   # API Host (defaults to window.location.hostname)
   REACT_APP_API_HOST=localhost
   
   # Individual service URLs (optional - uses defaults if not set)
   REACT_APP_API_GROUP_BASEURL=http://localhost:8001
   REACT_APP_API_SHOP_BASEURL=http://localhost:8002
   REACT_APP_API_VIDEO_BASEURL=http://localhost:8003
   REACT_APP_API_LINK_BASEURL=http://localhost:8005
   REACT_APP_API_DEVICE_BASEURL=http://localhost:8005
   REACT_APP_API_DVSG_BASEURL=http://localhost:8005
   
   # Pagination
   REACT_APP_API_PAGE_SIZE=100
   ```

4. **Start the development server**
   ```bash
   npm start
   # or
   yarn start
   ```

   The app will open at `http://localhost:3000`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run development server |
| `npm run build` | Create production build |
| `npm test` | Run test suite |
| `npm run eject` | Eject from Create React App |

## API Configuration

The frontend connects to multiple backend services. Default ports:

| Service | Default Port | Environment Variable |
|---------|-------------|---------------------|
| Group | 8001 | `REACT_APP_API_GROUP_BASEURL` |
| Shop | 8002 | `REACT_APP_API_SHOP_BASEURL` |
| Video | 8003 | `REACT_APP_API_VIDEO_BASEURL` |
| DVSG (Combined) | 8005 | `REACT_APP_API_DVSG_BASEURL` |
| Device | 8005 | `REACT_APP_API_DEVICE_BASEURL` |
| Link | 8005 | `REACT_APP_API_LINK_BASEURL` |

## Usage

### Device Management

1. Click **Device** button to open device management modal
2. View all registered devices with online status
3. Add new devices with mobile ID
4. Monitor temperature and counters
5. Delete devices (must unlink first)

### Video Management

1. Click **Video** button to open video management modal
2. Upload new videos (supports MP4, WebM, etc.)
3. Configure video properties:
   - **Rotation**: 0°, 90°, 180°, 270°
   - **Fit Mode**: cover, contain, fill, none
   - **Display Duration**: seconds for slideshow
4. Preview videos with presigned S3 URLs

### Shop Management

1. Click **Shop** button to open shop management modal
2. Create new shops with names
3. Edit or delete existing shops

### Group Management

1. Click **Group** button to open group management modal
2. Create device groups
3. Assign videos to groups (bulk assignment)
4. All devices in a group receive the assigned videos

### Linking Resources

Use the Linker component to create associations between:
- Devices ↔ Videos
- Devices ↔ Shops
- Devices ↔ Groups
- Groups ↔ Videos (bulk assignment)

## Building for Production

```bash
npm run build
```

This creates an optimized build in the `build/` directory, ready for deployment.

### Deployment Options

- **Static hosting**: Serve the `build/` folder with nginx, Apache, or any static file server
- **CDN**: Deploy to AWS S3 + CloudFront, Vercel, Netlify, etc.
- **Container**: Use with nginx in a Docker container

Example nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/dgx-frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8005;
    }
}
```

## Dependencies

### Production
```json
{
  "@emotion/react": "^11.14.0",
  "@emotion/styled": "^11.14.1",
  "@mui/material": "^7.3.2",
  "axios": "^1.12.2",
  "lucide-react": "^0.544.0",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "react-scripts": "5.0.1",
  "web-vitals": "^2.1.4"
}
```

### Development
```json
{
  "autoprefixer": "^10.4.22",
  "postcss": "^8.5.6",
  "postcss-preset-env": "^10.4.0"
}
```

## Browser Support

### Production
- \>0.2% market share
- Not dead browsers
- No Opera Mini

### Development
- Last 1 Chrome version
- Last 1 Firefox version
- Last 1 Safari version

## Troubleshooting

### Common Issues

**CORS Errors**
- Ensure backend services have CORS enabled
- Check that API URLs are correctly configured

**API Connection Failed**
- Verify backend services are running
- Check environment variables
- Confirm network connectivity

**Videos Not Playing**
- Verify S3 bucket permissions
- Check presigned URL expiration
- Ensure correct content type

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license here]

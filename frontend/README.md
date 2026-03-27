# VoxTranslate Frontend

A modern, production-quality Next.js 14 frontend for the VoxTranslate video translation pipeline. Built with React, TypeScript, and Tailwind CSS.

## Features

- **Dashboard**: Real-time overview of active jobs, statistics, and quick submission
- **Job Submission**: Batch upload YouTube videos with language hints and OST detection
- **Job Queue**: Comprehensive table view of all jobs with filtering and pagination
- **Job Details**: Detailed job tracking with real-time pipeline progress visualization
- **Settings**: System health monitoring and API configuration
- **Responsive Design**: Fully responsive layout with mobile-friendly navigation
- **Real-time Updates**: Server-sent events (SSE) for live job status updates
- **Dark Sidebar**: Professional navy blue sidebar with white content area

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **State Management**: React Hooks

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with sidebar
│   ├── page.tsx            # Dashboard page
│   ├── globals.css         # Global styles and Tailwind directives
│   ├── submit/
│   │   └── page.tsx        # Video submission page
│   ├── jobs/
│   │   ├── page.tsx        # Jobs list page
│   │   └── [id]/
│   │       └── page.tsx    # Job detail page with pipeline visualization
│   ├── settings/
│   │   └── page.tsx        # Settings and system health
│   └── components/
│       └── Sidebar.tsx     # Navigation sidebar
├── components/
│   ├── StatusBadge.tsx     # Status indicator component
│   ├── PipelineProgress.tsx # Pipeline stage visualization
│   ├── JobCard.tsx         # Job list item component
│   ├── StatsCard.tsx       # Statistics card component
│   └── SubmitForm.tsx      # Video submission form
├── next.config.js          # Next.js configuration with API rewrites
├── tailwind.config.ts      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
└── Dockerfile              # Docker build configuration
```

## API Integration

The frontend proxies API requests to `http://localhost:8000` via Next.js rewrites.

### Expected API Endpoints

- `GET /api/stats` - Get dashboard statistics
- `GET /api/jobs` - List all jobs
- `GET /api/jobs?limit=10` - List recent jobs
- `POST /api/jobs` - Submit a single job
- `POST /api/batch` - Submit multiple jobs
- `GET /api/jobs/{id}` - Get job details
- `GET /api/jobs/{id}/events` - Server-sent events for real-time updates
- `GET /api/jobs/{id}/download` - Download DOCX translation
- `POST /api/jobs/{id}/retry` - Retry failed job
- `GET /api/health` - System health status

## Environment Variables

```env
# Backend API configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Application environment
NODE_ENV=development
```

## Docker

### Build Image

```bash
docker build -t voxtranslate-frontend:latest .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://backend:8000 \
  voxtranslate-frontend:latest
```

## Features Details

### Dashboard
- Real-time statistics cards (active jobs, daily/weekly counts, average processing time)
- Quick submission form or full submission page link
- Recent jobs list with inline status and progress
- Auto-refresh every 10 seconds

### Job Submission
- Support for batch URL submission (one per line)
- Language hint dropdown
- Optional OST (Original Soundtrack) detection toggle
- Form validation and error handling
- Success feedback with job IDs

### Job Queue
- Filterable views (All, Active, Completed, Failed)
- Sortable columns: Video, Language, Status, Progress, Submitted
- Responsive table on desktop, card layout on mobile
- Pagination support
- Progress bars for active jobs

### Job Details
- Full job information card with thumbnail
- Pipeline progress visualization with 5 stages:
  - Download
  - Transcribe
  - Detect OST
  - Translate
  - Export
- Real-time SSE updates during processing
- Translation preview and DOCX download when completed
- Error details and retry button for failed jobs
- Job status badges with animations

### Settings
- API endpoint configuration display
- API key management interface
- System health monitoring:
  - Overall status indicator
  - Redis cache status
  - Database status
  - Active worker count
  - API version information
- Auto-refresh health status every 30 seconds

## Styling

The application uses a professional color scheme:

- **Sidebar**: Navy Blue (#1a1a2e)
- **Accent**: Blue (#3b82f6)
- **Success**: Green (#10b981)
- **Warning**: Orange (#f59e0b)
- **Error**: Red (#ef4444)
- **Background**: Light Gray (#f9fafb)

## Performance Optimizations

- Server-side rendering for initial page load
- CSS-in-JS with Tailwind for minimal CSS bundle
- Image optimization with Next.js Image component
- Lazy loading of components where applicable
- Debounced API calls
- Efficient state management with React hooks

## Accessibility

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Mobile-friendly touch targets

## Error Handling

- Graceful error states with user-friendly messages
- API error handling with axios interceptors
- Loading states for async operations
- Network error recovery suggestions

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Follow the existing code structure and naming conventions
2. Use TypeScript for type safety
3. Ensure responsive design for all screen sizes
4. Test all API integrations
5. Add proper error handling and loading states

## License

Internal use only. All rights reserved.

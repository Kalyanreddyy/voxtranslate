# VoxTranslate Frontend - Quick Start Guide

## Installation & Setup (2 minutes)

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Set environment variables
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Prerequisites

- The VoxTranslate backend must be running on `http://localhost:8000`
- Node.js 20 or higher
- npm or yarn

## Development Commands

```bash
npm run dev      # Start development server (hot reload)
npm run build    # Create production build
npm start        # Start production server
npm run lint     # Run linter
```

## Project Layout

- **`app/`** - Next.js App Router pages and layouts
  - `page.tsx` - Dashboard homepage
  - `submit/` - Video submission page
  - `jobs/` - Job queue and detail pages
  - `settings/` - System settings and health monitoring
  - `components/` - Layout components (Sidebar)
  - `globals.css` - Global styles and Tailwind directives

- **`components/`** - Reusable React components
  - `StatusBadge.tsx` - Job status indicator
  - `PipelineProgress.tsx` - Processing stage visualization
  - `JobCard.tsx` - Job list item
  - `StatsCard.tsx` - Statistics display card
  - `SubmitForm.tsx` - Video submission form

- **Config files**
  - `next.config.js` - Next.js config with API proxy
  - `tailwind.config.ts` - Tailwind CSS theme
  - `tsconfig.json` - TypeScript config
  - `package.json` - Dependencies and scripts

## Available Pages

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | Overview with stats and recent jobs |
| Submit Video | `/submit` | Batch video submission |
| Job Queue | `/jobs` | Filterable list of all jobs |
| Job Details | `/jobs/{id}` | Full job tracking and pipeline |
| Settings | `/settings` | System health and configuration |

## Key Features

✅ **Real-time Updates** - SSE-based live job status
✅ **Pipeline Visualization** - 5-stage processing pipeline display
✅ **Batch Submission** - Submit multiple videos at once
✅ **Responsive Design** - Works on desktop, tablet, and mobile
✅ **Error Handling** - User-friendly error messages
✅ **Loading States** - Skeleton screens and spinners
✅ **Accessibility** - Semantic HTML and ARIA labels

## API Integration

The frontend automatically proxies requests to the backend:

```
http://localhost:3000/api/... → http://localhost:8000/api/...
```

## Styling

- **Colors**: Navy sidebar (#1a1a2e), blue accent (#3b82f6)
- **Framework**: Tailwind CSS with custom components
- **Responsive**: Mobile-first design with Tailwind breakpoints
- **Components**: Custom badge, button, card, and input styles

## Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running on `http://localhost:8000`
- Check CORS configuration in backend
- Verify `next.config.js` rewrites are configured correctly

### "Styles not loading"
- Run `npm install` to ensure Tailwind is installed
- Restart dev server with `npm run dev`
- Clear `.next` folder: `rm -rf .next && npm run dev`

### "API responses are slow"
- Check backend performance
- Verify network connectivity
- Look for large payloads in Network tab

## Production Deployment

### Docker

```bash
docker build -t voxtranslate-frontend:latest .
docker run -p 3000:3000 voxtranslate-frontend:latest
```

### Manual Build

```bash
npm run build
npm start
```

## Code Structure & Conventions

- **Page Routes**: Use `app/` directory structure
- **Components**: Stateless where possible, use `'use client'` for interactivity
- **Styling**: Tailwind classes with custom component layer in `globals.css`
- **API Calls**: Axios with error handling in components
- **Types**: Full TypeScript with explicit interfaces

## Next Steps

1. **Customize Branding**: Update logo in `Sidebar.tsx` and favicon in `layout.tsx`
2. **Add More Pages**: Create new routes in `app/` directory
3. **Extend Components**: Add new UI components in `components/`
4. **Improve Styling**: Modify `tailwind.config.ts` and `globals.css`
5. **Add Tests**: Create `.test.tsx` files alongside components

## Support & Documentation

- Next.js Docs: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- Lucide Icons: https://lucide.dev
- TypeScript: https://www.typescriptlang.org/docs

---

**Need help?** Check the main `README.md` for detailed documentation.

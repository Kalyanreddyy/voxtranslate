# Getting Started with VoxTranslate Frontend

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm** or **yarn** - Included with Node.js
- **Git** - For version control
- **VoxTranslate Backend** - Running on `http://localhost:8000`

## Installation Steps

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Axios
- Lucide React

### 2. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local if needed (optional for development)
# The defaults work with a local backend on port 8000
```

### 3. Start Development Server

```bash
npm run dev
```

The application will start on **http://localhost:3000**

Open your browser and navigate to http://localhost:3000

## What You'll See

### Home Page (Dashboard)
- **Statistics Cards**: Shows active jobs, daily/weekly counts, average processing time
- **Quick Submit Form**: Fast way to submit a single video
- **Recent Jobs List**: Shows the 10 most recent jobs with status

### Navigation Menu (Sidebar)
- **Dashboard** - Overview and quick stats
- **Submit Job** - Full submission form with batch support
- **Job Queue** - Browse all jobs with filters and sorting
- **Settings** - System health monitoring

## First Steps

### 1. Check Backend Connection
Navigate to **Settings** page to verify the backend is connected:
- You should see the API endpoint status
- All system components should show "Connected"

### 2. Submit a Test Video
Go to **Submit Job** page and try submitting a YouTube video:
- Paste a YouTube URL
- (Optional) Select language and OST detection
- Click "Submit for Processing"

### 3. Monitor Processing
Visit **Job Queue** to see your job:
- It should appear in the list
- Status will update as it processes through the pipeline
- Click on it to view detailed progress

### 4. View Job Details
Click any job to see:
- Full video information
- Pipeline stage progress visualization
- Real-time updates (if processing)
- Download option (if completed)

## Development Features

### Hot Reload
Changes to code automatically refresh the browser - no manual restart needed.

### TypeScript Support
Full type checking and IDE autocomplete for better development experience.

### Tailwind CSS
All styling uses Tailwind utility classes. Modify `tailwind.config.ts` to customize colors.

## Common Tasks

### Change API URL
If your backend is on a different server:

1. Edit `next.config.js`
2. Update the `destination` URL in the rewrites section:
```javascript
destination: 'http://your-api-url:8000/api/:path*'
```

### Customize Colors
Edit `tailwind.config.ts` to change the color scheme:

```typescript
colors: {
  sidebar: '#your-color',
  accent: '#your-color',
  // ...
}
```

### Add a New Page
Create a new file in the `app/` directory following the Next.js App Router structure:

```typescript
// app/mypage/page.tsx
export default function MyPage() {
  return <div>My Page</div>
}
```

Then add it to the sidebar menu in `app/components/Sidebar.tsx`.

### API Testing
Use the browser's Network tab (DevTools) to inspect API calls:
1. Open DevTools (F12)
2. Go to Network tab
3. Perform an action that makes an API call
4. Click on the request to see details

## Troubleshooting

### "Cannot GET /" or blank page
- Make sure `npm run dev` is running
- Check that http://localhost:3000 is accessible
- Clear browser cache (Ctrl+Shift+Delete)

### "Failed to connect to backend"
- Verify backend is running on http://localhost:8000
- Check `next.config.js` has correct backend URL
- Look at browser console for specific error message

### Styles not loading
```bash
# Remove build cache and restart
rm -rf .next
npm run dev
```

### Port 3000 already in use
```bash
# Use a different port
npm run dev -- -p 3001
# Then visit http://localhost:3001
```

### Dependencies not found
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## Project Structure Overview

```
frontend/
├── app/                    # Pages and layout
│   ├── page.tsx           # Dashboard home
│   ├── layout.tsx         # Root layout
│   ├── submit/page.tsx    # Submit page
│   ├── jobs/page.tsx      # Jobs list
│   ├── jobs/[id]/page.tsx # Job detail
│   └── settings/page.tsx  # Settings
├── components/             # Reusable UI components
├── lib/                    # Utility functions and hooks
├── app/globals.css         # Global styles
└── package.json            # Dependencies
```

## Key Features

✓ Real-time job status updates (Server-Sent Events)
✓ Batch video submission
✓ Visual pipeline progress tracking
✓ Responsive design (mobile, tablet, desktop)
✓ System health monitoring
✓ Error handling and recovery
✓ Professional UI with Tailwind CSS
✓ Full TypeScript support

## Building for Production

### Create Production Build
```bash
npm run build
npm start
```

### Docker Build
```bash
docker build -t voxtranslate-frontend:latest .
docker run -p 3000:3000 voxtranslate-frontend:latest
```

## Next Steps

1. **Explore the Code**: Open files and read the comments
2. **Read Documentation**: Check `README.md` and `IMPLEMENTATION_SUMMARY.md`
3. **Customize**: Modify colors, add pages, integrate features
4. **Deploy**: Follow production build instructions above
5. **Monitor**: Check backend logs for any issues

## Need Help?

### Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Debugging Tips
1. Use browser DevTools (F12)
2. Check browser console for errors
3. Look at Network tab to inspect API calls
4. Read error messages carefully - they often suggest solutions
5. Try the troubleshooting section above

## Success Indicators

You'll know everything is working when:
- [ ] Home page loads without errors
- [ ] Settings page shows "Connected" status
- [ ] You can submit a video without errors
- [ ] The job appears in the Job Queue
- [ ] Job details page loads and shows progress

## Tips for Development

- **Save often**: Use Ctrl+S to save files
- **Watch console**: Keep DevTools open to catch errors
- **Test responsive design**: Use DevTools device emulation (Ctrl+Shift+M)
- **Use TypeScript**: Let IDE catch errors before runtime
- **Read error messages**: They usually tell you exactly what's wrong

## Common Patterns

### Making API Calls
```typescript
const response = await axios.get('/api/jobs')
const data = response.data
```

### Using Components
```typescript
import JobCard from '@/components/JobCard'
// Use it in your page
<JobCard id="123" title="Video" status="processing" ... />
```

### Styling Elements
```typescript
<div className="bg-white rounded-lg shadow-md p-4">
  Content here
</div>
```

### Handling Forms
```typescript
const [value, setValue] = useState('')
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="input-field"
/>
```

---

**Ready to start?** Run `npm run dev` and open http://localhost:3000

Good luck with VoxTranslate! 🚀

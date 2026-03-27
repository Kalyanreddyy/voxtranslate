# VoxTranslate Frontend - Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [x] All TypeScript files compile without errors
- [x] All imports are correct and files exist
- [x] No console.log statements left in production code
- [x] Error handling implemented for all API calls
- [x] Loading states present for async operations
- [x] No hardcoded credentials or secrets

### Functionality
- [x] Dashboard loads and displays stats
- [x] Job submission form works
- [x] Job queue list displays properly
- [x] Job detail page shows pipeline progress
- [x] Settings page shows system health
- [x] Navigation between pages works
- [x] Real-time updates (SSE) functioning
- [x] Error messages display correctly
- [x] Responsive design works on mobile/tablet/desktop

### Accessibility
- [x] Semantic HTML structure
- [x] ARIA labels on interactive elements
- [x] Proper heading hierarchy
- [x] Color contrast meets WCAG AA
- [x] Keyboard navigation working
- [x] Focus indicators visible

## Development Environment Setup

### Prerequisites
```bash
# Verify Node.js version (needs 20+)
node --version
# Expected output: v20.x.x

# Verify npm version
npm --version
# Expected output: 10.x.x or higher
```

### Installation
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install
# Watch for any warnings or errors

# 3. Verify installation
npm list
# Should show all packages without errors
```

## Local Development Testing

### Start Development Server
```bash
npm run dev
# Expected: "ready started server on 0.0.0.0:3000"
```

### Test Each Page
- [ ] Home (/) - Stats cards load, recent jobs display
- [ ] Submit (/submit) - Form submits successfully
- [ ] Jobs (/jobs) - List displays, filters work, pagination works
- [ ] Job Detail (/jobs/[id]) - Shows job info, pipeline progress
- [ ] Settings (/settings) - System health displays

### Test Responsive Design
```bash
# In browser DevTools:
# 1. Press F12
# 2. Click device icon (Ctrl+Shift+M)
# 3. Test at different breakpoints:
#    - iPhone SE (375px)
#    - iPad (768px)
#    - Desktop (1920px)
```

### Test API Integration
- [ ] Backend server running on http://localhost:8000
- [ ] API calls succeed without CORS errors
- [ ] Error messages display for failed requests
- [ ] Real-time updates work (SSE)
- [ ] Job submission creates new jobs
- [ ] File download works (DOCX)

### Browser Testing
Test in latest versions of:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## Production Build Process

### Build Optimization
```bash
# Run production build
npm run build
# Should complete without errors
# Output: Built successfully!

# Start production server
npm start
# Should run on port 3000

# Test production build
# Visit http://localhost:3000 in browser
```

### Bundle Analysis
```bash
# Check bundle size
npm run build
# Look for any warnings about bundle size
# All chunks should be reasonable size
```

## Docker Deployment

### Build Docker Image
```bash
# From frontend directory
docker build -t voxtranslate-frontend:latest .

# Verify image built
docker images | grep voxtranslate-frontend
```

### Test Docker Container
```bash
# Run container
docker run -p 3000:3000 voxtranslate-frontend:latest

# Test in browser
# Visit http://localhost:3000

# Stop container
# Press Ctrl+C
```

### Container Verification
- [ ] Container starts without errors
- [ ] Application loads on port 3000
- [ ] All pages work inside container
- [ ] API calls work (if backend is accessible)
- [ ] Container stops gracefully
- [ ] No security warnings in image

## Environment Configuration

### Environment Variables
```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with actual values
# NEXT_PUBLIC_API_BASE_URL=http://your-backend:8000
```

### Production Environment Variables
```
# Create .env.production
NEXT_PUBLIC_API_BASE_URL=http://production-backend-url:8000
NODE_ENV=production
```

## Security Checklist

- [x] No hardcoded API keys or secrets
- [x] No credentials in environment files
- [x] API key is optional and not required
- [x] HTTPS ready (configuration in backend/reverse proxy)
- [x] CORS configured properly
- [x] No sensitive data in console logs
- [x] Form inputs are sanitized
- [x] API calls use HTTPS in production
- [x] Environment variables used for sensitive config
- [x] No vulnerable dependencies

Verify with:
```bash
npm audit
# Should show 0 vulnerabilities
```

## Performance Checklist

### Lighthouse Score
- [ ] Performance: > 90
- [ ] Accessibility: > 95
- [ ] Best Practices: > 90
- [ ] SEO: > 90

Run audit:
```bash
# In Chrome DevTools:
# 1. Open DevTools (F12)
# 2. Go to Lighthouse tab
# 3. Click "Analyze page load"
```

### Load Time Targets
- [ ] First Contentful Paint: < 2s
- [ ] Largest Contentful Paint: < 2.5s
- [ ] Cumulative Layout Shift: < 0.1
- [ ] Time to Interactive: < 3.5s

## Monitoring & Logging

### Set Up Monitoring
- [ ] Error tracking service configured (e.g., Sentry, Rollbar)
- [ ] Analytics configured (e.g., Google Analytics, Mixpanel)
- [ ] Logging service configured (e.g., ELK stack, CloudWatch)
- [ ] Alerts configured for errors and downtime

### Production Logs
```bash
# Monitor application logs
docker logs -f container_name

# Check error rates
# Check API response times
# Monitor memory usage
# Monitor CPU usage
```

## Deployment Steps

### 1. Pre-Deployment
```bash
# Final build
npm run build

# Run tests
npm run lint

# Verify no errors
# Check bundle size
```

### 2. Deploy to Staging
```bash
# Build and push Docker image
docker build -t voxtranslate-frontend:latest .
docker tag voxtranslate-frontend:latest registry/voxtranslate-frontend:staging
docker push registry/voxtranslate-frontend:staging

# Deploy to staging environment
# Run smoke tests
# Verify all functionality
```

### 3. Deploy to Production
```bash
# Tag production image
docker tag voxtranslate-frontend:latest registry/voxtranslate-frontend:v1.0.0
docker push registry/voxtranslate-frontend:v1.0.0

# Deploy to production
# Monitor for errors
# Check user reports
```

### 4. Post-Deployment
```bash
# Monitor application performance
# Check error logs
# Verify all pages load
# Test critical user flows
# Monitor API latency
# Check user analytics
```

## Rollback Plan

### If Issues Occur
```bash
# Revert to previous version
docker pull registry/voxtranslate-frontend:previous-version
docker run -p 3000:3000 registry/voxtranslate-frontend:previous-version

# OR

# Revert code and rebuild
git revert commit-id
npm run build
docker build -t voxtranslate-frontend:rollback .
```

## Health Checks

### Application Health
```bash
# Test each endpoint
curl http://localhost:3000
curl http://localhost:3000/api/health
curl http://localhost:3000/submit
curl http://localhost:3000/jobs
curl http://localhost:3000/settings
```

### Backend Connectivity
```bash
# Verify backend is reachable
curl http://localhost:8000/api/health
```

### Monitoring
- [ ] Application up and responsive
- [ ] All routes accessible
- [ ] API calls succeeding
- [ ] No error spikes
- [ ] Performance within targets
- [ ] Real-time updates working

## Post-Deployment Verification

### User Testing
- [ ] Can submit videos
- [ ] Jobs appear in queue
- [ ] Job details display correctly
- [ ] Pipeline progress updates
- [ ] Can download translations
- [ ] Settings shows correct status

### Performance Verification
- [ ] Page loads within 2 seconds
- [ ] No layout shifts during load
- [ ] Smooth animations
- [ ] Responsive on all devices
- [ ] No console errors

### Data Verification
- [ ] Jobs persist correctly
- [ ] Status updates are accurate
- [ ] Timestamps are correct
- [ ] File downloads work
- [ ] No data loss

## Success Criteria

✅ All pages load without errors
✅ API integration working correctly
✅ Real-time updates functioning
✅ Responsive design verified
✅ Performance targets met
✅ Security checks passed
✅ No console errors
✅ All user flows tested
✅ Mobile tested and working
✅ Accessibility verified
✅ Monitoring in place
✅ Logs being collected
✅ Team notified of deployment
✅ Documentation updated

## Contacts & Support

- **Technical Lead**: [Name/Contact]
- **DevOps**: [Name/Contact]
- **Backend Team**: [Name/Contact]
- **On-Call**: [Phone/Slack]

## Notes

- Keep deployment window within business hours
- Have rollback plan ready before deployment
- Notify stakeholders of deployment
- Monitor closely for first hour after deployment
- Document any issues encountered
- Update runbooks and documentation
- Schedule post-deployment review

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Deployment Time**: [Date/Time]
**Status**: [Success/Issues]

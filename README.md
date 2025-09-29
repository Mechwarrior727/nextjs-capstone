# Next.js Google Fit Integration

A Next.js application with Google Fit API integration using Privy authentication for secure OAuth token handling.

## Features

- 🔐 Secure OAuth token management with Privy
- 📊 Google Fit step count data visualization
- ⚡ Vercel serverless function optimization
- 🔄 Automatic token refresh and caching
- 🎨 Responsive UI with real-time status updates
- 🚨 Comprehensive error handling

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Authentication**: Privy (OAuth + wallet support)
- **Backend**: Next.js API Routes with Vercel serverless functions
- **APIs**: Google Fit REST API

## Getting Started

### Prerequisites

1. **Privy Account**: Sign up at [privy.io](https://privy.io) and create an app
2. **Google Cloud Console**: Enable Google Fit API and configure OAuth credentials
3. **Vercel Account**: For deployment

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd nextjs-capstone
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials:
```env
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable the Google Fit API
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials
6. Add your domain to authorized origins

### Privy Configuration

1. Go to your [Privy Dashboard](https://dashboard.privy.io)
2. Navigate to Configuration > App settings
3. Copy your App ID and App Secret
4. Add them to `.env.local`

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Testing the API locally:**
- API routes work during development
- Test Google Fit integration at `http://localhost:3000/api/fit`
- Check browser console for detailed logs
- Use browser dev tools to inspect network requests

### Building for Production

```bash
npm run build
```

## Testing & Deployment

### Local Testing

**✅ API routes work locally** - you can test everything before deploying:

1. **Start development server:**
```bash
npm run dev
```

2. **Test the Google Fit API:**
- Login with Google through Privy
- Check browser console for OAuth token capture
- Click "Get Step Data" to test the integration
- API calls go through `http://localhost:3000/api/fit`

3. **Debug information available:**
- Browser console shows detailed logs
- Development UI shows debug panels
- Network tab shows API requests

### Vercel Deployment

**🚀 Option 1: Automatic Deployment (Recommended)**

1. **Push to GitHub:**
```bash
git add .
git commit -m "Complete Google Fit integration"
git push origin main
```

2. **Connect to Vercel:**
- Go to [vercel.com](https://vercel.com)
- Click "Import Project"
- Connect your GitHub repository
- Vercel will automatically detect it's a Next.js app

3. **Add Environment Variables:**
   - In Vercel dashboard, go to your project → Settings → Environment Variables
   - Add:
     ```
     NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
     PRIVY_APP_SECRET=your-privy-app-secret
     ```

4. **Deploy:**
- Vercel automatically builds and deploys
- Your app will be live at `your-project.vercel.app`

**🚀 Option 2: Manual Deployment**

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Deploy:**
```bash
vercel --prod
```

4. **Add Environment Variables:**
```bash
vercel env add NEXT_PUBLIC_PRIVY_APP_ID
vercel env add PRIVY_APP_SECRET
```

### Environment Variables Setup

**Required for both local and production:**

1. **Get your Privy credentials:**
   - Go to [Privy Dashboard](https://dashboard.privy.io)
   - Navigate to Configuration → App settings
   - Copy App ID and App Secret

2. **Local development (`.env.local`):**
```env
NEXT_PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
```

3. **Vercel production:**
   - Add the same variables in Vercel dashboard
   - Or use `vercel env add` commands

### Vercel Configuration

The `vercel.json` file is already configured:

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "nodejs18.x",
      "maxDuration": 30
    }
  },
  "buildCommand": "npm run build",
  "framework": "nextjs"
}
```

### Post-Deployment Steps

1. **Test the live app:**
   - Visit your deployed URL
   - Login with Google
   - Test Google Fit integration

2. **Monitor logs:**
   - Vercel dashboard → Functions → Logs
   - Check for any API errors

3. **Update DNS (if needed):**
   - Point your domain to Vercel's nameservers
   - Configure custom domain in Vercel dashboard

### Troubleshooting Deployment

**Common issues:**
- **Build failures**: Check environment variables are set
- **API errors**: Verify Privy credentials are correct
- **OAuth issues**: Ensure Google OAuth is configured properly

**Check logs:**
- Vercel dashboard → Deployments → View Logs
- Browser console for frontend errors
- Network tab for API request details

## How It Works

### Authentication Flow

1. **User logs in with Google** via Privy
2. **Privy captures OAuth tokens** (stored securely server-side)
3. **Frontend attempts direct Google Fit API call** using captured tokens
4. **Fallback to server-side API route** if direct call fails
5. **Step data is processed and returned** with visualization

### Current Implementation Notes

**Frontend-Only Approach:**
- Uses `useOAuthTokens` hook to capture Google OAuth tokens
- Makes direct Google Fit API calls from the browser
- Falls back to server-side API route if needed
- Includes comprehensive debugging and error handling

**OAuth Token Access:**
- The `useOAuthTokens` hook should capture tokens during OAuth flow
- If tokens aren't captured, try clicking "Refresh Google Auth"
- Direct API calls may face CORS restrictions in some browsers

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  Direct API Call │───▶│  Google Fit API │
│   (Next.js)     │    │  (Browser)       │    │                 │
│                 │    │                  │    │                 │
│ • useOAuthTokens│    │ • OAuth Token    │    │ • Step Data     │
│ • Error Handling│    │ • Fallback Route │    │ • Processing    │
│ • UI Feedback   │    │ • Comprehensive  │    │ • Visualization │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Security Features

- **OAuth token capture**: Uses Privy's secure `useOAuthTokens` hook
- **Direct API calls**: Minimal server involvement for testing
- **Fallback mechanism**: Server-side API route as backup
- **Token refresh**: Automatic reauthorization on expiration
- **Error boundaries**: Graceful failure handling
- **Input validation**: Prevents injection attacks

## API Reference

### `/api/fit` - Get Google Fit Step Data

**Method**: POST

**Request Body**:
```json
{
  "privyAccessToken": "string",
  "userId": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "days": [
      {
        "date": "2024-01-01",
        "steps": 8500
      }
    ],
    "total": 42500
  },
  "metadata": {
    "daysCount": 5,
    "dateRange": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-05T23:59:59.999Z"
    },
    "cached": false
  }
}
```

**Error Responses**:
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "action": "suggested_action"
}
```

## Troubleshooting

### Common Issues

1. **"No Google OAuth token found"**
   - Ensure user logged in with Google
   - Check OAuth scopes include fitness data
   - Verify Privy app secret is correct

2. **"Token expired"**
   - The system automatically attempts reauthorization
   - If persistent, check Google OAuth settings

3. **Build failures**
   - Ensure all environment variables are set
   - Check Vercel function logs for detailed errors

### Debug Information

The app includes debug panels (development mode only) that show:
- Authentication status
- Token availability
- API response details
- Error information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Quick Start Summary

1. **Setup**: Add `PRIVY_APP_SECRET` to `.env.local`
2. **Test Locally**: `npm run dev` → Login with Google → Check console logs
3. **Deploy**: Push to GitHub → Connect to Vercel → Add environment variables
4. **Verify**: Test live app with Google Fit integration

## License

This project is licensed under the MIT License.

# Jules Frontend

A modern Next.js frontend for the Jules AI companion app.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access the app:**
   - Frontend: http://localhost:3000
   - Make sure your backend is running on http://localhost:5000

## Features

- 🏠 **Landing Page** - Marketing page with FAQ and video
- 💬 **Chat Interface** - Real-time chat with Jules AI
- 🔐 **Authentication** - Login/register with JWT tokens
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Fast Development** - Hot reload with Turbopack

## Backend Connection

The frontend connects to your Node.js backend running on port 5000. Make sure your backend server is running before testing the chat functionality.

**Backend endpoints used:**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration  
- `POST /api/chat` - Send messages to Jules
- `GET /api/auth/profile` - Get user profile

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── page.tsx         # Landing page
│   ├── chat/            # Chat interface
│   ├── login/           # Authentication
│   ├── privacy-policy/  # Legal pages
│   └── terms-of-service/
├── lib/                 # Utilities
│   └── api.ts          # Backend API client
└── public/             # Static assets
```

## Development

1. Start backend: `cd ../jules-backend && npm start`
2. Start frontend: `npm run dev`
3. Open http://localhost:3000

Both servers need to be running for full functionality.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

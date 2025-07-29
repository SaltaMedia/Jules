# Jules - AI Companion Platform

This repository contains the Jules AI companion platform with multiple specialized applications.

## 🏗️ Project Structure

```
Jules/
├── jules-core/              # Original Jules (dating, style, mindset)
│   ├── jules-backend/      # Core backend API
│   ├── jules-frontend/     # Core frontend application
│   ├── jules-chat/         # Chat interface
│   └── ... (documentation, configs)
├── jules-style-app/        # Style-focused vertical
│   ├── backend/           # Style-specific backend
│   ├── frontend/          # Style-specific frontend
│   └── ... (style configs)
└── README.md              # This file
```

## 🚀 Applications

### Jules Core (Original)
- **Purpose**: Full-featured AI companion for dating, style, and mindset
- **Ports**: Frontend 3000, Backend 4000
- **Features**: Dating advice, style guidance, mindset coaching, practice scenarios
- **Location**: `jules-core/`

### Jules Style App
- **Purpose**: Specialized men's fashion guidance
- **Ports**: Frontend 3001, Backend 4001
- **Features**: Direct, opinionated fashion advice, style recommendations
- **Location**: `jules-style-app/`

## 🛠️ Development

### Running Jules Core
```bash
cd jules-core
npm install
cd jules-backend && npm run dev  # Port 4000
cd jules-frontend && npm run dev # Port 3000
```

### Running Jules Style
```bash
cd jules-style-app
./start-dev.sh  # Ports 3001 & 4001
```

## 📋 Port Summary

| Application | Frontend | Backend | Purpose |
|-------------|----------|---------|---------|
| Jules Core  | 3000     | 4000    | Full AI companion |
| Jules Style | 3001     | 4001    | Fashion guidance |

## 🔧 Environment Setup

Each application has its own environment configuration:
- `jules-core/jules-backend/.env` - Core backend settings
- `jules-style-app/backend/.env` - Style backend settings

## 📚 Documentation

- **Jules Core**: See `jules-core/` for original documentation
- **Jules Style**: See `jules-style-app/README.md` for style app docs

## 🚀 Deployment

Each application can be deployed independently:
- **Jules Core**: Deploy `jules-core/` to production
- **Jules Style**: Deploy `jules-style-app/` to style.juleslabs.com

## 🤝 Contributing

1. Choose the appropriate application directory
2. Follow the specific setup instructions for that app
3. Test thoroughly before submitting changes

## 📄 License

Private and proprietary.
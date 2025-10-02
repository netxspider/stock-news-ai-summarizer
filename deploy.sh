#!/bin/bash

echo "🚀 Deploying Stock News AI Summarizer..."
echo ""

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "❌ No git repository found. Please initialize git first:"
    echo "   git init"
    echo "   git remote add origin YOUR_REPO_URL"
    exit 1
fi

# Build the project
echo "📦 Building for production..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Add and commit changes
echo "📝 Committing changes..."
git add .
git commit -m "🚀 Prepare for deployment - $(date)"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ Push failed!"
    exit 1
fi

echo "✅ Pushed to GitHub!"
echo ""

echo "🎉 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Go to https://vercel.com"
echo "2. Click 'New Project'"
echo "3. Import your GitHub repository"
echo "4. Add these environment variables:"
echo "   - GEMINI_API_KEY"
echo "   - POLYGON_API_KEY"
echo "   - USE_REAL_AI=true"
echo "   - NODE_ENV=production"
echo ""
echo "5. Deploy! 🚀"
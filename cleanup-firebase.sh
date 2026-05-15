#!/bin/bash

# Firebase Cleanup Script
# This script removes Firebase dependencies and files after migration to Supabase
# Usage: ./cleanup-firebase.sh

echo "🧹 Starting Firebase cleanup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Backup important files first
echo "📦 Creating backup of important files..."
mkdir -p .backup
cp -r src/firebase .backup/ 2>/dev/null || echo "⚠️ Firebase config not found, skipping backup"
cp -r src/utils/firebaseAuth.ts .backup/ 2>/dev/null || echo "⚠️ Firebase auth not found, skipping backup"

# Remove Firebase packages
echo "📦 Removing Firebase packages..."
npm uninstall @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore 2>/dev/null || echo "⚠️ Some Firebase packages may not be installed"

# Remove Firebase config files
echo "🗑️ Removing Firebase config files..."
rm -rf src/firebase/
rm -f src/utils/firebaseAuth.ts

# Remove Firebase-specific imports from source files (this is a basic cleanup)
echo "🔧 Cleaning up Firebase imports..."
find src/ -name "*.ts" -o -name "*.tsx" | while read file; do
    # Remove Firebase imports
    sed -i.tmp "s/.*from.*firebase.*//g" "$file"
    sed -i.tmp "s/.*from.*@react-native-firebase.*//g" "$file"
    
    # Remove empty import lines
    sed -i.tmp '/^import.*$/d' "$file"
    sed -i.tmp '/^$/N;/^\n$/d' "$file" # Remove consecutive empty lines
    
    # Clean up temp file
    rm -f "$file.tmp"
done

# Remove Android Firebase configuration
echo "🤖 Cleaning up Android Firebase config..."
if [ -d "android/app" ]; then
    rm -f android/app/google-services.json
    rm -f android/app/src/debug/google-services.json
    rm -f android/app/src/release/google-services.json
fi

# Remove iOS Firebase configuration
echo "🍎 Cleaning up iOS Firebase config..."
if [ -d "ios" ]; then
    rm -f ios/GoogleService-Info.plist
    rm -f ios/DelivryX/GoogleService-Info.plist
fi

# Update package.json scripts to remove Firebase references
echo "📝 Updating package.json scripts..."
if command -v jq &> /dev/null; then
    # Remove Firebase-related scripts if jq is available
    jq 'del(.scripts[] | select(test("firebase")))' package.json > package.json.tmp && mv package.json.tmp package.json
else
    echo "⚠️ jq not found. Please manually remove Firebase-related scripts from package.json"
fi

# Remove Firebase from app.json if present
echo "📱 Updating app.json..."
if [ -f "app.json" ]; then
    sed -i.tmp '/firebase/d' app.json
    rm -f app.json.tmp
fi

# Clean up node_modules and reinstall
echo "🔄 Cleaning up node_modules..."
rm -rf node_modules package-lock.json
npm install

echo "✅ Firebase cleanup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Review the changes and fix any remaining Firebase imports"
echo "2. Test the application to ensure Supabase integration works"
echo "3. Update any remaining Firebase references in your code"
echo "4. Remove this script and the .backup directory once you're confident everything works"
echo ""
echo "⚠️  Important: Make sure you have a complete backup before proceeding!"
echo "📁 Backup created in: .backup/"

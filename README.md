# DelivryX - Package Delivery Management System

A React Native application for managing package deliveries with real-time tracking, driver management, and offline synchronization.

## Features

- 📦 **Package Management**: Create, update, and track packages through delivery lifecycle
- 👥 **Driver Management**: Manage drivers, assignments, and availability
- 🔄 **Real-time Updates**: Live tracking of package status and driver locations
- 📱 **Offline Support**: Full offline functionality with automatic sync
- 🔐 **Role-based Access**: Admin and driver roles with appropriate permissions
- 📊 **Analytics**: Package statistics and delivery insights

## Technology Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Real-time + Auth)
- **State Management**: Zustand
- **Storage**: AsyncStorage with encrypted storage for sensitive data
- **Navigation**: React Navigation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd delivryx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Run the SQL schema from `supabase-schema.sql` in the Supabase SQL editor
   - Get your project URL and anon key from Supabase settings

4. **Configure environment variables**
   ```bash
   # Create .env file with your Supabase credentials
   touch .env
   ```
   
   Edit `.env` with your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Run the application**
   - Use the Expo Go app on your device
   - Or run on simulator: `npm run android` or `npm run ios`

## Database Schema

### Tables

- **packages**: Package information and delivery status
- **drivers**: Driver profiles and availability
- **profiles**: User profiles extending Supabase auth
- **sync_operations**: Offline sync queue management
- **sync_metadata**: Sync status and timestamps

### Key Features

- **Row Level Security (RLS)**: Ensures users can only access appropriate data
- **Real-time Subscriptions**: Live updates across all connected clients
- **Foreign Key Constraints**: Data integrity between related tables
- **Timestamp Tracking**: Automatic creation and modification timestamps

## Authentication

The application uses Supabase Auth with role-based access control:

- **Admin Users**: Full access to all packages and drivers
- **Driver Users**: Access only to assigned packages and personal information

### User Roles

- `admin`: Can manage all packages, drivers, and system settings
- `driver`: Can view and update assigned packages only

## Offline Support

The application provides full offline functionality:

- **Local Storage**: Packages and drivers stored locally using AsyncStorage
- **Sync Queue**: Changes queued when offline and synced when connection restored
- **Conflict Resolution**: Automatic resolution of data conflicts
- **Real-time Sync**: Background synchronization when online

## API Reference

### Authentication

```typescript
import { signInWithEmail, signOut, getCurrentUser } from './src/utils/supabaseAuth';

// Sign in
const user = await signInWithEmail(email, password);

// Sign out
await signOut();

// Get current user
const user = await getCurrentUser();
```

### Database Operations

```typescript
import { 
  getPackages, 
  createPackage, 
  updatePackage,
  getDrivers,
  createDriver 
} from './src/utils/supabaseDatabase';

// Get all packages
const packages = await getPackages();

// Create new package
const newPackage = await createPackage(packageData);

// Update package
const updatedPackage = await updatePackage(packageId, updates);
```

### Real-time Updates

```typescript
import { listenToPackages, listenToDriverPackages } from './src/utils/supabaseRealtime';

// Listen to all package changes
const subscription = listenToPackages((payload) => {
  console.log('Package changed:', payload);
});

// Listen to driver-specific packages
const driverSubscription = listenToDriverPackages(driverId, (payload) => {
  console.log('Driver package changed:', payload);
});
```

## Migration from Firebase

If you're migrating from Firebase/Firestore:

1. **Set up Supabase** (see Getting Started)
2. **Run the migration script**:
   ```bash
   node scripts/migrate-data.js
   ```
3. **Update application code** to use Supabase utilities
4. **Clean up Firebase dependencies**:
   ```bash
   ./cleanup-firebase.sh
   ```

See `migration-guide.md` for detailed migration instructions.

## Development

### Project Structure

```
src/
├── components/          # Reusable UI components
├── config/            # Configuration files
├── hooks/             # Custom React hooks
├── screens/           # Application screens
├── utils/             # Utility functions
│   ├── supabaseAuth.ts
│   ├── supabaseDatabase.ts
│   ├── supabaseRealtime.ts
│   └── supabaseSync.ts
├── types/             # TypeScript type definitions
└── store/             # State management
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `EXPO_PUBLIC_USE_SUPABASE_*` | Feature flags for gradual migration | No |

### Feature Flags

Use environment variables to enable/disable features during development:

```env
EXPO_PUBLIC_USE_SUPABASE_AUTH=true
EXPO_PUBLIC_USE_SUPABASE_DATABASE=true
EXPO_PUBLIC_USE_SUPABASE_REALTIME=true
EXPO_PUBLIC_USE_SUPABASE_SYNC=true
```

## Testing

### Running Tests

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Manual Testing Checklist

- [ ] User authentication (admin and driver roles)
- [ ] Package CRUD operations
- [ ] Driver CRUD operations
- [ ] Real-time updates across devices
- [ ] Offline functionality and sync
- [ ] Role-based access control
- [ ] Search and filtering
- [ ] Data export/import

## Deployment

### Building for Production

```bash
# Build for Android
npm run build:android

# Build for iOS
npm run build:ios

# Build for Web
npm run build:web
```

### Environment Setup

1. **Production Supabase**: Set up production Supabase project
2. **Environment Variables**: Configure production environment
3. **Build Configuration**: Update app.json for production
4. **Store Deployment**: Deploy to app stores

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- 📧 Email: support@delivryx.com
- 📖 Documentation: [link to docs]
- 🐛 Issues: [GitHub Issues]

## Changelog

### v2.0.0 - Supabase Migration
- ✅ Migrated from Firebase/Firestore to Supabase
- ✅ Enhanced offline sync capabilities
- ✅ Improved real-time performance
- ✅ Added comprehensive error handling
- ✅ Updated authentication system

### v1.1.0 - Feature Enhancements
- ✅ Added package search functionality
- ✅ Improved driver management
- ✅ Enhanced offline support

### v1.0.0 - Initial Release
- ✅ Basic package and driver management
- ✅ Firebase authentication and database
- ✅ Real-time updates
- ✅ Offline functionality

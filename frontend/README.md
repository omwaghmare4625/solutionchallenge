# Frontend Modules (Field Worker)

## Mobile (React Native / Expo)

Set backend URL in environment:

- `EXPO_PUBLIC_BACKEND_URL=http://<YOUR_BACKEND_URL>`

Install dependencies:

```bash
cd frontend/mobile
npm install
npx expo install expo-location expo-image-picker
npm install @react-native-async-storage/async-storage
```

Key files:

- `src/screens/SubmitReportScreen.js`
- `src/services/reportService.js`
- `src/config/api.js`

## Web (Next.js optional)

Set backend URL in environment:

- `NEXT_PUBLIC_BACKEND_URL=http://<YOUR_BACKEND_URL>`

Install and run:

```bash
cd frontend/web
npm install
npm run dev
```

Page:

- `app/submit/page.js`

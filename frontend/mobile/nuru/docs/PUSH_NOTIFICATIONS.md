# Push Notifications (FCM) — setup

The Nuru mobile app uses Firebase Cloud Messaging to deliver push
notifications for **every** in-app event: chat messages, payments,
event invitations, RSVPs, follows, bookings, etc.

## How it works

1. The Flutter app initialises Firebase on startup and asks the OS for
   notification permission.
2. After sign-in, the app POSTs the device's FCM token to
   `POST /calls/devices` (`kind: "fcm"`).
3. Whenever the backend creates a notification (`utils.notify.create_notification`)
   or a chat message is sent (`POST /messages/{conv}`), it fans out a push
   to every registered device for the recipient via FCM HTTP v1.

## Backend setup (one-time)

You need a **Firebase service account** JSON for the project that owns
the mobile app.

1. Firebase Console → Project Settings → **Service accounts** → "Generate new private key".
2. Save the file somewhere on the server (e.g. `/etc/nuru/firebase.json`).
3. Set **one** of these env vars (the backend reads them at runtime):
   - `FCM_SERVICE_ACCOUNT_FILE=/etc/nuru/firebase.json`  *(recommended)*
   - or `FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`

That's it. The backend will log `[fcm] send failed` if the credentials
are missing or invalid; pushes are best-effort and never block the API.

## Mobile setup (one-time per platform)

### Android
1. Firebase Console → add an **Android app** with package id `tz.nuru.app`.
2. Download `google-services.json` and drop it at:
   `mobile/nuru/android/app/google-services.json`
3. Build — the `com.google.gms.google-services` plugin (already wired in
   `android/app/build.gradle.kts`) picks it up automatically.

### iOS
1. Firebase Console → add an **iOS app** with the bundle id from
   `ios/Runner.xcodeproj`.
2. Download `GoogleService-Info.plist` and drag it into the **Runner**
   target in Xcode (so it's added to the app bundle).
3. In the Runner target, enable the **Push Notifications** capability and
   **Background Modes → Remote notifications**.
4. Upload your APNs Auth Key (`.p8`) to Firebase Console → Cloud Messaging.

No code changes needed — `AppDelegate.swift` already calls
`FirebaseApp.configure()` and registers for remote notifications.

## Channels

- **Android channel id**: `nuru_default` (created automatically by
  `PushNotificationService` on first run; high importance).
- **Foreground messages**: shown via `flutter_local_notifications` so the
  user always sees the alert even when the app is open.
- **Background / killed**: handled directly by the system tray.

## Tap routing

Tapping a notification deep-links into the app:
- `type=message` → `/chat` with the conversation_id
- `type=payment*` / `withdrawal` → `/wallet`
- `type=event_invite` / `committee_invite` / `rsvp_update` → `/event`
- anything else → `/notifications`

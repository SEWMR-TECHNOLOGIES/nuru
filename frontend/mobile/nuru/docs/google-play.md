# Nuru — Google Play Publishing Guide

Everything you need to publish Nuru to the Google Play Console. Copy/paste
the bold sections directly into the Play Console fields.

---

## 1. Store listing

### App identity

| Field | Value |
|---|---|
| **App name** | `Nuru` |
| **Default language** | `English (United States) – en-US` |
| **App / Game** | `App` |
| **Free / Paid** | `Free` (with optional in-app purchases via Lipa Number / Mobile Money — billed outside Google Play) |
| **Application ID (package name)** | `tz.nuru.app` |
| **Category** | `Events` (alt: `Social`) |
| **Tags** | `Events`, `Social`, `Productivity`, `Lifestyle` |

### Short description (max 80 chars)

> `One workspace for any event — invitations, RSVPs, tickets, payments, chat.`

### Full description (max 4000 chars)

```
Nuru is the all-in-one workspace and social platform for events. Whether
you are planning a wedding, send-off, graduation, conference, fundraiser,
baby shower, memorial, ticketed concert, exhibition or a private dinner —
Nuru gives you a single, trusted place to organise, fund and live it end
to end. If it concerns an event, it belongs in Nuru.

✦ Beautiful invitation cards
Pick from event-type-aware QR invitation cards (weddings, birthdays,
graduations, send-offs, memorials, baby showers, exhibitions, conferences,
galas, corporate launches and more). Personalise with your couple/host
name, date, venue, dress code and a private QR code per guest.

✦ Real RSVPs and guest management
Track who's coming, who paid, who arrived. Bulk-invite by phone, share
secure invite links, and let guests confirm in seconds.

✦ Contributions, gifts and ticketing
Collect contributions and gifts via mobile money (M-Pesa, Tigo Pesa,
Airtel Money, Halopesa) or cards. Sell tickets with reserved seating,
VIP tiers, promo codes and offline scan-and-claim at the door.

✦ Event groups & messaging
A dedicated group chat per event for organisers, vendors, the committee
and guests — with media, voice notes, polls and templated broadcasts.

✦ Service providers & vendors
Discover verified caterers, photographers, MCs, DJs, decorators and
venues. Compare quotes, chat, book and pay safely with built-in escrow
that only releases funds once the service is delivered.

✦ Live meetings
Run committee meetings, planning sessions and rehearsals over secure
in-app voice/video rooms with recording and shared minutes.

✦ Smart wallet & receipts
Every contribution and ticket purchase produces an instant printable
receipt. Track money in/out from one wallet across all your events.

✦ A social feed for event moments
Share reels, photos and milestones from your events; follow organisers,
vendors and communities you care about.

✦ Multilingual & multi-currency
Available in English and Swahili, with localised payment rails and
cross-border transfer support for guests anywhere in the world.

Download Nuru and run your next event with the calm confidence of a
professional planner.

Questions? hello@nuru.tz · Privacy: https://nuru.tz/privacy-policy
```

### Listing assets

| Asset | Spec | File |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, no alpha | `mobile/nuru/assets/images/launcher_icons/...` (export from `src/assets/nuru-logo-square.png`) |
| Feature graphic | 1024×500 JPG/PNG, no alpha | `src/assets/google-play-feature-graphic.jpg` (also at `/mnt/documents/nuru-feature-graphic-1024x500.jpg`) |
| Phone screenshots | 16:9 / 9:16, min 320 px, max 3840 px, 2–8 images | Capture from a release build on a Pixel-class device |
| 7" tablet screenshots (optional) | 1024–3840 px | Optional but recommended |
| 10" tablet screenshots (optional) | 1024–3840 px | Optional |
| Promo video (optional) | YouTube URL, 30–120 s | Add later |

### Contact

| Field | Value |
|---|---|
| **Website** | `https://nuru.tz` |
| **Email** | `hello@nuru.tz` |
| **Phone** | `+255 653 750 805` |
| **Privacy policy URL** | `https://nuru.tz/privacy-policy` |
| **Terms URL** | `https://nuru.tz/terms` |
| **Account/data deletion URL** | `https://nuru.tz/data-deletion` |

---

## 2. App content & policies (Play Console → Policy)

### Target audience

- Primary: **18+** (adults). Not directed at children.
- Mixed-audience, no children-specific features.

### Content rating questionnaire (IARC)

- Violence: **None**
- Sexuality / nudity: **None**
- Profanity: **None**
- Controlled substances: **None**
- Gambling: **None** (no real-money games of chance — payments are for goods/services only)
- User-generated content: **Yes** (posts, moments, group chat). Has report/block, in-app moderation, and admin takedown tools.
- Shares user location: **Yes** (event location only, with prompt)
- Digital purchases: **No** (real-world goods/services; payments are processed off-Play via mobile-money rails)
- Expected rating: **PEGI 12 / IARC Teen** (moderate UGC)

### Data safety form (Play Console → App content → Data safety)

**Data we collect:**

| Data | Purpose | Required? | Shared with 3rd parties? |
|---|---|---|---|
| Name | Account, RSVPs, invitations | Required | No (only with hosts you RSVP to) |
| Email | Account, login OTP, receipts, notifications | Required | No |
| Phone number | Account, OTP, mobile-money payments | Required | Payment processors (Selcom, Sewmr SMS) |
| Profile photo | Profile / chat avatars | Optional | No |
| Approximate / precise location | Event location, "near me" search | Optional, runtime prompt | No |
| Photos & videos | Posts, moments, event galleries, KYC | Optional, runtime prompt | No |
| Audio | Voice notes, in-app voice/video calls (LiveKit) | Optional, runtime prompt | LiveKit (call routing only) |
| Contacts | NOT collected | — | — |
| Calendar | NOT accessed | — | — |
| Financial info | Mobile-money number, transaction history | Required for payments | Selcom, Sewmr (payment & SMS gateways) |
| App activity (in-app) | Analytics, fraud detection | Required | No |
| Device IDs | Push notifications (FCM) | Required | Google (FCM) |
| Crash logs | Stability | Required | Google (Crashlytics if enabled) |
| Diagnostics | Performance monitoring | Required | No |

**All data is:**
- ✅ **Encrypted in transit** (HTTPS everywhere)
- ✅ **Encrypted at rest** (PostgreSQL TDE, Cloudflare R2 server-side encryption)
- ✅ **Deletable** — users can request deletion at https://nuru.tz/data-deletion
- ❌ Not sold to third parties
- ❌ Not used for ad targeting

**Account / data deletion URL:** `https://nuru.tz/data-deletion`
(Required by Google Play — already implemented; submissions land in
Admin → Deletion Requests.)

### Permissions declared (AndroidManifest.xml)

| Permission | Why |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | API calls, real-time messaging |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Set event location, "near me" service search |
| `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Pick event photos/videos to share |
| `READ_EXTERNAL_STORAGE` (≤ SDK 28) | Legacy media access on older Android |
| `CAMERA` | Take event photos, scan invitation/ticket QR |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | Voice notes, in-app meetings |
| `BLUETOOTH_CONNECT` | Bluetooth audio routing during calls |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Keep voice/video calls alive |
| `WAKE_LOCK` | Keep call active while screen off |
| `VIBRATE` | Notification feedback |
| `POST_NOTIFICATIONS` | Push notifications (Android 13+) |

### Sensitive permissions justification

- **Foreground service (mediaProjection)**: required for in-app voice/video meetings and ongoing call state, never used for screen recording without an explicit user-initiated meeting.
- **Camera/microphone**: only invoked from a user gesture (take photo, start meeting, scan QR).
- **Location**: only requested when the user opens the location picker on Create Event or Find Services.

### Ads

- **No ads.**

### COVID-19 / News / Government / Financial features

- **Financial features → Yes** (collects payments). We act as a marketplace facilitator using licensed payment processors (Selcom). We do not issue credit, do not handle deposits, and do not perform crypto exchange.

---

## 3. App release (versioning)

### Current versions

- **versionName**: `1.0.0` (from `mobile/nuru/pubspec.yaml`)
- **versionCode**: `1`
- **minSdk**: `29` (Android 10)
- **targetSdk**: latest stable (set by Flutter — Play requires API 34+ as of 2024-08; verify on each release)
- **compileSdk**: latest (set by Flutter)

### Versioning rules

Update `version: 1.0.0+1` in `mobile/nuru/pubspec.yaml`. The format is
`<versionName>+<versionCode>`.

| Change | Bump |
|---|---|
| Bug fixes only | `1.0.0+1` → `1.0.1+2` |
| New non-breaking feature | `1.0.1+2` → `1.1.0+3` |
| Breaking redesign / data migration | `1.1.0+3` → `2.0.0+4` |

`versionCode` (`+N`) MUST strictly increase on every Play upload — never
reuse a number, even for an internal track. Recommended convention: bump
by 1 every release; for hotfixes also bump by 1.

After bumping in `pubspec.yaml`, also update the row in the
`app_version_settings` table (or POST through the admin endpoint) so the
in-app **Update available** banner appears for older clients:

```sql
UPDATE app_version_settings
   SET latest_version = '1.0.1',
       latest_build = 2,
       min_supported_build = 1,    -- raise to force-update older clients
       force_update = false
 WHERE platform = 'android';
```

---

## 4. Build the release artifact

### One-time: create the upload keystore

```bash
keytool -genkey -v \
  -keystore ~/keys/nuru-upload-keystore.jks \
  -alias nuru-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore file and **both passwords** in a password manager —
losing them locks you out of updating the app. (Play App Signing means
Google holds the *signing* key; you only manage the *upload* key.)

Create `mobile/nuru/android/key.properties` (gitignored):

```properties
storePassword=<store password>
keyPassword=<key password>
keyAlias=nuru-upload
storeFile=/absolute/path/to/nuru-upload-keystore.jks
```

### Wire up signing in `android/app/build.gradle.kts`

Replace the placeholder `signingConfig = signingConfigs.getByName("debug")`
block with:

```kotlin
import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) load(FileInputStream(f))
}

android {
    // ...existing config...

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = keystoreProperties["storeFile"]?.let { file(it as String) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
        }
    }
}
```

### Build the AAB (preferred by Play) and an APK for sideload testing

```bash
cd mobile/nuru
flutter clean
flutter pub get
flutter build appbundle --release         # → build/app/outputs/bundle/release/app-release.aab
flutter build apk --release --split-per-abi   # → build/app/outputs/flutter-apk/*.apk (for QA only)
```

### Verify the signature

```bash
# AAB
jarsigner -verify -verbose -certs \
  build/app/outputs/bundle/release/app-release.aab

# APK (with bundletool or apksigner from Android SDK)
~/Android/Sdk/build-tools/<latest>/apksigner verify --print-certs \
  build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

You should see your `nuru-upload` certificate fingerprint, **not** the
Android debug certificate.

### Upload

Play Console → **Production** (or Internal testing first) → **Create
release** → upload `app-release.aab` → fill release notes → roll out.

---

## 5. 16 KB native page-size compliance

From **Nov 1, 2025**, every new app or app update targeting Android 15+
must be compatible with **16 KB memory page sizes** on 64-bit devices.
Flutter apps need: Flutter **3.24+** with AGP **8.5.1+** and NDK **r27+**.

### What we have already configured

These are already pinned in `mobile/nuru/android/app/build.gradle.kts` so the
app builds 16 KB-aligned out of the box — you do **not** need to set them
manually:

| Setting | Value | Why |
|---|---|---|
| `ndkVersion` | `27.0.12077973` (NDK r27) | r27 is the first NDK that links every `.so` with 16 KB-aligned ELF segments by default |
| `targetSdk` | `35` (Android 15) | Required to pass the Play Console 16 KB compliance check |
| `compileSdk` | `flutter.compileSdkVersion` (35+) | Needed for the Android 15 APIs |
| `packaging.jniLibs.useLegacyPackaging` | `false` | Stores `.so` files **uncompressed** and **page-aligned** inside the AAB so the loader can `mmap()` them on a 16 KB device |
| Gradle | `8.14` (`gradle-wrapper.properties`) | Pulls in AGP ≥ 8.5.1 which performs the alignment pass |
| AGP plugin | `8.11.1` (`android/settings.gradle.kts`) | ✅ ≥ 8.5.1 |

### What you must do once on your dev machine

1. Use **Flutter 3.24 or newer** — check with `flutter --version`. Older
   Flutter still ships the old engine `.so` files which are 4 KB-aligned.
2. Install NDK r27 from Android Studio → SDK Manager → SDK Tools →
   "Show Package Details" → check `27.0.12077973`. Gradle will also
   auto-download it on first build.
3. Run `flutter clean && flutter pub upgrade` before the first 16 KB
   release build so every plugin pulls its newest native libs.

### Verify the AAB is 16 KB-aligned

After building, run:

```bash
# Install Google's check-elf-alignment tool once
wget -O /tmp/check_elf_alignment.sh \
  https://github.com/android/ndk-samples/raw/main/page-size/check_elf_alignment.sh
chmod +x /tmp/check_elf_alignment.sh

# Extract .so files and check alignment
cd mobile/nuru/build/app/outputs/bundle/release
unzip -o app-release.aab -d /tmp/aab_check
/tmp/check_elf_alignment.sh /tmp/aab_check/base/lib
```

Every `.so` should report **`ALIGNED (16384)`**. If anything reports
`UNALIGNED` or `4096`, upgrade Flutter / AGP / NDK and rebuild.

### Test on a real 16 KB device or emulator

Create an emulator that boots with a 16 KB kernel — this is the only way
to catch a regression before Play does:

```
Android Studio → Device Manager → Create Device →
  Pixel 8 → System Image: "Android 15 — Google APIs (16 KB Page Size)"
```

Then `flutter run --release` and exercise: login, camera, QR scan, video
playback, voice notes, push notification, LiveKit call. Any plugin that
isn't 16 KB-ready will crash on launch with `dlopen failed: ... not
page-size compatible`.

### If a plugin is not yet 16 KB ready

Plugins most likely to need a version bump (they ship pre-built `.so`):
`livekit_client`, `mobile_scanner`, `video_player`, `video_thumbnail`,
`flutter_callkit_incoming`, `firebase_core`, `firebase_messaging`,
`record`, `audioplayers`, `image_cropper`, `flutter_secure_storage`.

1. `flutter pub upgrade <plugin_name>` — bump to the latest version.
2. If `check_elf_alignment.sh` still flags it, open the plugin's GitHub
   issues for "16 KB page size" / "page size compatible" and either wait
   for the fix, fork + rebuild with NDK r27, or replace the plugin.
3. The packaging block above already enables uncompressed native libs;
   no extra `gradle.properties` flag is needed with AGP 8.5+.

---

## 6. Pre-launch checklist

- [ ] Bump `version` in `mobile/nuru/pubspec.yaml`
- [ ] Update `app_version_settings` row in production DB
- [ ] `flutter build appbundle --release` succeeds and is signed with the upload key
- [ ] `check_elf_alignment.sh` reports all `.so` libs ALIGNED (16384)
- [ ] Privacy policy live at `https://nuru.tz/privacy-policy`
- [ ] Terms live at `https://nuru.tz/terms`
- [ ] Data deletion form live at `https://nuru.tz/data-deletion`
- [ ] App icon (512×512) and feature graphic (1024×500) uploaded
- [ ] At least 2 phone screenshots from a release build
- [ ] Data Safety form completed and matches actual data flows
- [ ] Content rating questionnaire submitted
- [ ] Target audience set to 18+
- [ ] Internal-testing track release rolled out and tested on a real device
- [ ] App Links verified (`assetlinks.json` already in `public/.well-known/`)
- [ ] Push notifications received on a fresh install
- [ ] Mobile-money payment succeeds end-to-end on production
- [ ] Force-close + reopen restores session and routes correctly
- [ ] Promote internal → closed → open → production

---

## 7. Useful URLs

- Play Console: <https://play.google.com/console>
- Data Safety help: <https://support.google.com/googleplay/android-developer/answer/10787469>
- Account deletion requirement: <https://support.google.com/googleplay/android-developer/answer/13327529>
- 16 KB page size: <https://developer.android.com/guide/practices/page-sizes>
- Target SDK schedule: <https://developer.android.com/google/play/requirements/target-sdk>

---

_Last updated: 2026-05-12_
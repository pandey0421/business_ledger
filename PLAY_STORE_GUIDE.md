# How to Publish Karobar Khata to Google Play Store

To publish your app so anyone can download it, you need to turn this project into a production app and upload it to Google.

## Phase 1: Preparation (One-time)
1.  **Google Play Developer Account**:
    -   Go to [Google Play Console](https://play.google.com/console).
    -   Sign up and pay the $25 one-time registration fee.
    -   Verify your identity.

## Phase 2: Build the App Bundle (AAB)
You cannot just upload code; you need a signed binary file.

1.  **Open Android Project**:
    In your terminal (VS Code), run:
    ```bash
    npx cap open android
    ```
    This launches **Android Studio**.

2.  **Generate Signed Bundle**:
    -   In Android Studio, go to menu: **Build > Generate Signed Bundle / APK**.
    -   Select **Android App Bundle** (not APK) -> Next.
    -   **Key Store Path**: Click "Create new...".
        -   Save it somewhere safe (e.g., in a secure folder, NOT inside the code folder if you share it).
        -   **Password**: Create a strong password (write it down!).
        -   **Alias**: `key0` (default is fine).
        -   **Certificate**: Fill in your name/business details (e.g., "Karobar Khata", "NP" for country).
    -   Click **Next**, select **release** build variant, and click **Finish**.

3.  **Locate the File**:
    -   Android Studio will show a popup "Generate Signed Bundle". Click **locate**.
    -   The file will be named `app-release.aab`. **This is the file you upload to Google.**

## Phase 3: Store Listing (In Google Play Console)
1.  **Create App**:
    -   Click **Create App**.
    -   Name: **Karobar Khata - Business Ledger**.
    -   Language: English (or Nepali if primary).
    -   App or Game: **App**.
    -   Free or Paid: **Free**.

2.  **Set up Store Listing**:
    -   **Short Description**: "Simple digital ledger for Nepali businesses."
    -   **Full Description**: Paste your app's features (Offline mode, Customer tracking, etc.).
    -   **Graphics**:
        -   **App Icon**: Upload the `512x512.png` from your `public` folder.
        -   **Feature Graphic**: You need a 1024x500 banner image (I can help generate a simple one if needed).
        -   **Screenshots**: Take screenshots of your app running on the emulator or phone.

3.  **Privacy Policy**:
    -   Use the URL of your hosted website's privacy page, or a simple hosted doc.

## Phase 4: Release
1.  Go to **Testing > Production**.
2.  Click **Create new release**.
3.  Upload the `app-release.aab` file you created in Phase 2.
4.  Review the release and click **Start Rollout to Production**.

## Application ID
Your App ID is `com.karobarkhata.app`. This is unique and permanent.

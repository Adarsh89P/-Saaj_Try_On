# Native Android Build via Capacitor

This plan outlines the steps to convert the existing Saaj Try-On PWA into a native Android application using Capacitor. This will allow you to generate an APK that can be installed directly on your device.

## User Review Required

> [!IMPORTANT]
> **Android Studio & SDK**: This process requires Android Studio and the Android SDK to be installed on your machine to compile the final APK.

> [!NOTE]
> **Package Name**: I have chosen `com.saaj.tryon` as the default package ID. Let me know if you want to change this.

## Proposed Changes

### Configuration

#### [NEW] [capacitor.config.json](file:///D:/Me/myApp/capacitor.config.json)
Initialize Capacitor configuration pointing to the `dist` web directory.

### Build & Integration

1.  **Initialize Capacitor**: Run `npx cap init` to set up the project identity.
2.  **Add Android Platform**: Run `npx cap add android` to create the native Android project folder.
3.  **Sync Web Assets**: Build the web project (`npm run build`) and sync it to the Android folder (`npx cap copy`).

## Verification Plan

### Manual Verification
1.  **Open in Android Studio**: I will run `npx cap open android`. You will need to click the "Run" button in Android Studio with your phone connected.
2.  **Generate APK**: Alternatively, I can attempt to run the Gradle build from the command line to produce a debug APK.
3.  **Verify on Device**: Install the resulting APK on your device and check if the camera and storage work as expected.

# Run on an Android emulator

This guide uses Android Studio to install the Android SDK, ADB and emulator on macOS, Linux or Windows. Complete the Node and pnpm prerequisites in the [README](../README.md#development-prerequisites) first.

## Install the Android tools

1. Install [Android Studio](https://developer.android.com/studio) and complete its setup wizard.
2. Open **Settings** (macOS: **Preferences**) → **Languages & Frameworks** → **Android SDK**. Note the Android SDK Location.
3. In **SDK Platforms**, install Android SDK Platform 37. In **SDK Tools**, install Android SDK Platform-Tools (includes `adb`), Android Emulator, Build-Tools 37.0.0 and NDK 27.1.12297006. Enable **Show Package Details** to select specific versions. Apply the changes and accept the licenses.
4. Install JDK 17 and ensure `java -version` reports it. Enable hardware virtualization if Android Studio requests it; installation steps depend on your operating system.

See the [Android Studio installation guide](https://developer.android.com/studio/install) and [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment) for platform-specific details.

## Configure the command line

Set `ANDROID_HOME` to the SDK location shown in Android Studio and add its `platform-tools` and `emulator` directories to your path. For example, on macOS using zsh, add this to `~/.zshrc`:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Run `source ~/.zshrc` or open a new terminal. On Linux the SDK is commonly at `$HOME/Android/Sdk`; use that location if it matches Android Studio. On Windows, set `ANDROID_HOME` and add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to your user environment variables, then reopen the terminal. An independently downloaded [Platform-Tools package](https://developer.android.com/tools/releases/platform-tools) can also provide `adb`; add its extracted directory to `PATH`. It does not include the emulator or system images.

Verify the tools:

```sh
java -version
adb version
emulator -version
```

## Create and select a virtual device

In Android Studio, open **Tools → Device Manager**, select **Create Device**, choose a phone and download a compatible system image. Choose an image matching your host architecture where available. Finish creating the Android Virtual Device (AVD), then start it using the play button. See [Create and manage virtual devices](https://developer.android.com/studio/run/managing-avds).

Alternatively, list and start an existing AVD from a terminal:

```sh
emulator -list-avds
emulator -avd YOUR_AVD_NAME
```

Use the exact name printed by `-list-avds`. Leave that terminal open and wait for Android to finish booting. Start a different AVD to change devices. If several devices are connected, use the picker described below.

## Build and run the app

From the app repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm android
```

Set `EXPO_PUBLIC_API_URL` in `.env.local` to the backend address. For a backend running on your computer at port 8000, the standard emulator address is `http://10.0.2.2:8000`. Start the backend separately; the emulator's `localhost` refers to the emulator itself. Follow the [first setup instructions](../README.md#first-setup) for authentication and other configuration.

`pnpm android` builds and installs the development app and starts Metro. To choose among available devices, use:

```sh
pnpm android --device
```

For subsequent JavaScript-only changes, start Metro with `pnpm start` and open the installed development app. Rebuild with `pnpm android` after native dependency or configuration changes.

## Useful commands

```sh
adb devices                       # List connected devices and their status
adb -s emulator-5554 shell        # Open a shell on a specific device
adb -s emulator-5554 emu kill     # Stop that emulator
adb logcat                        # Stream Android logs (Ctrl+C to stop)
pnpm start                        # Start Metro for an installed development build
```

Replace `emulator-5554` with the serial shown by `adb devices`. If the emulator is missing, wait for it to boot and run `adb devices` again. If tools cannot be found, check `ANDROID_HOME` and `PATH` in a new terminal. If the build fails, check the SDK packages, JDK version and the first error in the build output.

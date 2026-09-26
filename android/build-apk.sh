#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-$ROOT/.android-sdk}"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
OUT="$ROOT/android/build"
KEY="$ROOT/android/debug.keystore"

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

cd "$ROOT"
npx vite build --config vite.android.config.ts

mkdir -p "$ROOT/android/assets/www/icons" "$ROOT/android/assets/www/cv"
cp "$ROOT/public/icons/"*.png "$ROOT/android/assets/www/icons/"
rm -rf "$ROOT/android/assets/www/cv"
cp -a "$ROOT/public/cv" "$ROOT/android/assets/www/cv"
rm -rf "$ROOT/android/assets/www/ocr"
# Never nest an APK inside the APK — PackageManager treats that as corrupt.
rm -f "$ROOT/android/assets/www/WUBRGer.apk"

mkdir -p "$ROOT/android/res/mipmap-xxxhdpi" "$ROOT/android/res/mipmap-xxhdpi" "$ROOT/android/res/mipmap-xhdpi" "$ROOT/android/res/mipmap-mdpi"
cp "$ROOT/public/icons/icon-512.png" "$ROOT/android/res/mipmap-xxxhdpi/ic_launcher.png"
cp "$ROOT/public/icons/icon-192.png" "$ROOT/android/res/mipmap-xxhdpi/ic_launcher.png"
cp "$ROOT/public/icons/apple-touch-icon.png" "$ROOT/android/res/mipmap-xhdpi/ic_launcher.png"
cp "$ROOT/public/icons/favicon-32.png" "$ROOT/android/res/mipmap-mdpi/ic_launcher.png"

rm -rf "$OUT"
mkdir -p "$OUT/flat" "$OUT/gen" "$OUT/classes"

"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/flat"
FLATS=$(find "$OUT/flat" -name '*.flat' | tr '\n' ' ')
# shellcheck disable=SC2086
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$JAR" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  --java "$OUT/gen" \
  --min-sdk-version 26 \
  --target-sdk-version 34 \
  --version-code 2 \
  --version-name 1.0.1 \
  --auto-add-overlay \
  $FLATS

find "$ROOT/android/src" "$OUT/gen" -name '*.java' > "$OUT/sources.list"
javac --release 17 -encoding UTF-8 -cp "$JAR" -d "$OUT/classes" @"$OUT/sources.list"
# shellcheck disable=SC2046
"$BT/d8" --min-api 26 --lib "$JAR" --output "$OUT" $(find "$OUT/classes" -name '*.class')

"$BT/aapt" package -f \
  -M "$ROOT/android/AndroidManifest.xml" \
  -S "$ROOT/android/res" \
  -A "$ROOT/android/assets" \
  -I "$JAR" \
  -F "$OUT/app.apk" \
  --min-sdk-version 26 \
  --target-sdk-version 34

( cd "$OUT" && "$BT/aapt" add app.apk classes.dex )

"$BT/zipalign" -f -p 4 "$OUT/app.apk" "$OUT/aligned.apk"

if [[ ! -f "$KEY" ]]; then
  keytool -genkeypair -keystore "$KEY" -alias wubrger \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=WUBRGer, OU=Binder, O=WUBRGer, L=Local, ST=NA, C=US"
fi

"$BT/apksigner" sign \
  --ks "$KEY" --ks-key-alias wubrger \
  --ks-pass pass:android --key-pass pass:android \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$OUT/WUBRGer.apk" "$OUT/aligned.apk"

"$BT/apksigner" verify --print-certs "$OUT/WUBRGer.apk"
cp "$OUT/WUBRGer.apk" "$ROOT/public/WUBRGer.apk"
ls -lh "$ROOT/public/WUBRGer.apk"

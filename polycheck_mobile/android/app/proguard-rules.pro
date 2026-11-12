# Polycheck R8 rules.
#
# Flutter's own embedding rules are applied by the Flutter Gradle plugin.
# The entries below protect reflection/metadata-driven APIs used by plugins
# that ship native or ML Kit code; pure-Dart packages (qr_flutter,
# socket_io_client, drift) need no rules.

-keepattributes Signature,*Annotation*,EnclosingMethod,InnerClasses

# Flutter embedding + generated registrant.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# mobile_scanner / ML Kit barcode scanning.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_common.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.internal.mlkit_vision_barcode.**

# flutter_secure_storage (Android Keystore-backed AES + legacy ciphers).
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-keep class androidx.security.crypto.** { *; }
-dontwarn com.it_nomads.fluttersecurestorage.**

# sqlite3_flutter_libs / drift native bindings.
-keep class com.tekartik.sqflite.** { *; }
-keep class org.sqlite.** { *; }
-dontwarn org.sqlite.**

# geolocator / permission_handler plugin callbacks.
-keep class com.baseflow.geolocator.** { *; }
-keep class com.baseflow.permissionhandler.** { *; }
-dontwarn com.baseflow.**

# image_picker relies on AndroidX activity results.
-keep class io.flutter.plugins.imagepicker.** { *; }
-keep class com.fluttercandies.** { *; }
-dontwarn com.fluttercandies.**

package app.wubrger.binder;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** App-private JPEGs plus a Pictures/WUBRGer copy for the system gallery. */
final class CardAlbum {
  private final Context ctx;
  private final File dir;

  CardAlbum(Context ctx) {
    this.ctx = ctx.getApplicationContext();
    dir = new File(ctx.getFilesDir(), "cards");
    if (!dir.exists()) dir.mkdirs();
  }

  File dir() {
    return dir;
  }

  String saveJpeg(String title, String dataUrl) {
    byte[] raw = decodeDataUrl(dataUrl);
    if (raw == null || raw.length == 0) return "";
    String safe = slug(title);
    String name = safe + "-" + System.currentTimeMillis() + ".jpg";
    File file = new File(dir, name);
    try (FileOutputStream out = new FileOutputStream(file)) {
      out.write(raw);
      out.flush();
      out.getFD().sync();
    } catch (Exception e) {
      return "";
    }
    publishGallery(name, raw);
    return file.getAbsolutePath();
  }

  String readAsDataUrl(Uri uri) {
    try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
      if (in == null) return "";
      Bitmap bmp = BitmapFactory.decodeStream(in);
      if (bmp == null) return "";
      int w = bmp.getWidth();
      int h = bmp.getHeight();
      int max = 1280;
      if (w > max || h > max) {
        float s = Math.min(max / (float) w, max / (float) h);
        bmp = Bitmap.createScaledBitmap(bmp, Math.round(w * s), Math.round(h * s), true);
      }
      ByteArrayOutputStream buf = new ByteArrayOutputStream();
      bmp.compress(Bitmap.CompressFormat.JPEG, 85, buf);
      return "data:image/jpeg;base64," + Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP);
    } catch (Exception e) {
      return "";
    }
  }

  private void publishGallery(String name, byte[] raw) {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/WUBRGer");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        ContentResolver cr = ctx.getContentResolver();
        Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) return;
        try (OutputStream out = cr.openOutputStream(uri)) {
          if (out != null) out.write(raw);
        }
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        cr.update(uri, values, null, null);
      } else {
        File pics = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File folder = new File(pics, "WUBRGer");
        if (!folder.exists()) folder.mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(folder, name))) {
          out.write(raw);
        }
      }
    } catch (Exception ignored) {
    }
  }

  static byte[] decodeDataUrl(String dataUrl) {
    if (dataUrl == null || dataUrl.length() < 8) return null;
    int comma = dataUrl.indexOf(',');
    String b64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
    try {
      return Base64.decode(b64, Base64.DEFAULT);
    } catch (Exception e) {
      return null;
    }
  }

  static String slug(String title) {
    if (title == null || title.trim().length() == 0) return "card";
    String s = title.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-");
    if (s.length() > 48) s = s.substring(0, 48);
    return s.replaceAll("^-+|-+$", "");
  }
}

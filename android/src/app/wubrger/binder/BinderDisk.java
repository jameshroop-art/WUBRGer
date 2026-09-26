package app.wubrger.binder;

import android.content.Context;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Durable on-device binder. Atomic replace so a kill mid-write cannot truncate. */
final class BinderDisk {
  private final File file;
  private final File tmp;

  BinderDisk(Context ctx) {
    File dir = ctx.getFilesDir();
    file = new File(dir, "wubrger.binder.v1.json");
    tmp = new File(dir, "wubrger.binder.v1.json.tmp");
  }

  synchronized String read() {
    if (!file.exists()) return "";
    try (FileInputStream in = new FileInputStream(file)) {
      byte[] buf = new byte[(int) file.length()];
      int n = 0;
      while (n < buf.length) {
        int r = in.read(buf, n, buf.length - n);
        if (r < 0) break;
        n += r;
      }
      return new String(buf, 0, n, StandardCharsets.UTF_8);
    } catch (Exception e) {
      return "";
    }
  }

  synchronized void write(String value) {
    if (value == null) value = "";
    try {
      byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
      try (FileOutputStream out = new FileOutputStream(tmp)) {
        out.write(bytes);
        out.flush();
        out.getFD().sync();
      }
      if (!tmp.renameTo(file)) {
        if (file.exists()) file.delete();
        tmp.renameTo(file);
      }
    } catch (Exception ignored) {
    }
  }

  synchronized void remove() {
    if (file.exists()) file.delete();
    if (tmp.exists()) tmp.delete();
  }
}

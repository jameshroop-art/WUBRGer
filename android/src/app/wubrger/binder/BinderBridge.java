package app.wubrger.binder;

import android.webkit.JavascriptInterface;

public final class BinderBridge {
  private final BinderDisk disk;
  private final MainActivity activity;

  BinderBridge(BinderDisk disk, MainActivity activity) {
    this.disk = disk;
    this.activity = activity;
  }

  @JavascriptInterface
  public String read() {
    return disk.read();
  }

  @JavascriptInterface
  public void write(String value) {
    disk.write(value);
  }

  @JavascriptInterface
  public void remove() {
    disk.remove();
  }

  @JavascriptInterface
  public boolean hasCamera() {
    return activity.hasCameraPermission();
  }

  @JavascriptInterface
  public void requestCamera() {
    activity.askCameraPermission();
  }

  @JavascriptInterface
  public boolean hasPhotos() {
    return activity.hasPhotosPermission();
  }

  @JavascriptInterface
  public void requestPhotos() {
    activity.askPhotosPermission();
  }

  @JavascriptInterface
  public void pickPhoto() {
    activity.pickPhoto();
  }

  @JavascriptInterface
  public String saveCardImage(String title, String dataUrl) {
    return activity.saveCardImage(title, dataUrl);
  }
}

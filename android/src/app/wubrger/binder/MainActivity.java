package app.wubrger.binder;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
  static final String ORIGIN = "https://appassets.androidplatform.net";
  static final String HOME = ORIGIN + "/www/android.html";
  static final int REQ_CAMERA = 12;
  static final int REQ_MEDIA = 13;
  static final int REQ_PICK = 14;

  private WebView web;
  private BinderDisk disk;
  private CardAlbum album;
  private PermissionRequest pendingWebPerm;

  @Override
  protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    disk = new BinderDisk(this);
    album = new CardAlbum(this);

    web = new WebView(this);
    web.setBackgroundColor(0xFF0C0B09);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(true);
    s.setAllowContentAccess(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    if (Build.VERSION.SDK_INT >= 21) {
      s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    }

    web.addJavascriptInterface(new BinderBridge(disk, this), "WubrgerBinder");
    web.setWebViewClient(new LocalClient());
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(
                new Runnable() {
                  @Override
                  public void run() {
                    pendingWebPerm = request;
                    if (hasCameraPermission()) {
                      grantWebCamera(request);
                    } else {
                      requestNeededPermissions();
                    }
                  }
                });
          }

          @Override
          public void onPermissionRequestCanceled(PermissionRequest request) {
            pendingWebPerm = null;
          }
        });

    setContentView(web);
    requestNeededPermissions();
    web.loadUrl(HOME);
  }

  String[] neededPermissions() {
    ArrayList<String> list = new ArrayList<String>();
    list.add(Manifest.permission.CAMERA);
    if (Build.VERSION.SDK_INT >= 33) {
      list.add(Manifest.permission.READ_MEDIA_IMAGES);
    } else {
      list.add(Manifest.permission.READ_EXTERNAL_STORAGE);
      if (Build.VERSION.SDK_INT < 29) {
        list.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
      }
    }
    return list.toArray(new String[0]);
  }

  void requestNeededPermissions() {
    ArrayList<String> missing = new ArrayList<String>();
    String[] all = neededPermissions();
    for (int i = 0; i < all.length; i++) {
      if (checkSelfPermission(all[i]) != PackageManager.PERMISSION_GRANTED) missing.add(all[i]);
    }
    if (missing.isEmpty()) {
      notifyJsCamera(true);
      notifyJsPhotos(true);
      return;
    }
    requestPermissions(missing.toArray(new String[0]), REQ_MEDIA);
  }

  boolean hasCameraPermission() {
    return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
  }

  boolean hasPhotosPermission() {
    if (Build.VERSION.SDK_INT >= 33) {
      return checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
    }
    return checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
  }

  void askCameraPermission() {
    runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            if (hasCameraPermission()) {
              notifyJsCamera(true);
              return;
            }
            requestNeededPermissions();
          }
        });
  }

  void askPhotosPermission() {
    runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            if (hasPhotosPermission()) {
              notifyJsPhotos(true);
              return;
            }
            requestNeededPermissions();
          }
        });
  }

  void pickPhoto() {
    runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            try {
              Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
              intent.setType("image/*");
              intent.addCategory(Intent.CATEGORY_OPENABLE);
              startActivityForResult(Intent.createChooser(intent, "Card photo"), REQ_PICK);
            } catch (Exception e) {
              notifyJsPhoto("");
            }
          }
        });
  }

  String saveCardImage(String title, String dataUrl) {
    return album.saveJpeg(title, dataUrl);
  }

  void grantWebCamera(PermissionRequest request) {
    if (request == null) return;
    try {
      request.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
    } catch (Exception e) {
      try {
        request.grant(request.getResources());
      } catch (Exception ignored) {
      }
    }
    pendingWebPerm = null;
  }

  void notifyJsCamera(boolean ok) {
    if (web == null) return;
    web.evaluateJavascript(
        "window.__wubrgerCam&&window.__wubrgerCam(" + (ok ? "true" : "false") + ")", null);
  }

  void notifyJsPhotos(boolean ok) {
    if (web == null) return;
    web.evaluateJavascript(
        "window.__wubrgerPhotos&&window.__wubrgerPhotos(" + (ok ? "true" : "false") + ")", null);
  }

  void notifyJsPhoto(String dataUrl) {
    if (web == null) return;
    if (dataUrl == null) dataUrl = "";
    String payload = dataUrl.replace("\\", "\\\\").replace("'", "\\'");
    web.evaluateJavascript("window.__wubrgerPhoto&&window.__wubrgerPhoto('" + payload + "')", null);
  }

  @Override
  public void onRequestPermissionsResult(int code, String[] permissions, int[] grantResults) {
    boolean cam = hasCameraPermission();
    boolean pics = hasPhotosPermission();
    if (cam && pendingWebPerm != null) grantWebCamera(pendingWebPerm);
    else if (!cam && pendingWebPerm != null) {
      try {
        pendingWebPerm.deny();
      } catch (Exception ignored) {
      }
      pendingWebPerm = null;
    }
    notifyJsCamera(cam);
    notifyJsPhotos(pics);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != REQ_PICK) return;
    if (resultCode != RESULT_OK || data == null || data.getData() == null) {
      notifyJsPhoto("");
      return;
    }
    String url = album.readAsDataUrl(data.getData());
    notifyJsPhoto(url);
  }

  @Override
  protected void onResume() {
    super.onResume();
    notifyJsCamera(hasCameraPermission());
    notifyJsPhotos(hasPhotosPermission());
  }

  @Override
  protected void onPause() {
    super.onPause();
    if (web != null) {
      web.evaluateJavascript(
          "(function(){try{if(window.WubrgerBinder&&localStorage){var k='wubrger.binder.v1';var v=localStorage.getItem(k);if(v)WubrgerBinder.write(v);}}catch(e){}})()",
          null);
    }
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  final class LocalClient extends WebViewClient {
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
      Uri uri = req.getUrl();
      if (uri == null || !"appassets.androidplatform.net".equals(uri.getHost())) return null;
      String path = uri.getPath();
      if (path == null || path.length() < 2) path = "/www/android.html";
      if (path.equals("/") || path.equals("/www") || path.equals("/www/")) path = "/www/android.html";
      String asset;
      if (path.startsWith("/www/")) asset = path.substring(1);
      else if (path.startsWith("/")) asset = "www" + path;
      else asset = "www/" + path;
      try {
        AssetManager am = getAssets();
        InputStream in = am.open(asset);
        String mime = mimeOf(asset);
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cross-Origin-Resource-Policy", "cross-origin");
        return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, in);
      } catch (Exception e) {
        byte[] empty = new byte[0];
        return new WebResourceResponse(
            "text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(empty));
      }
    }
  }

  static String mimeOf(String path) {
    String p = path.toLowerCase();
    if (p.endsWith(".html")) return "text/html";
    if (p.endsWith(".js")) return "text/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".json")) return "application/json";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
    if (p.endsWith(".svg")) return "image/svg+xml";
    if (p.endsWith(".webp")) return "image/webp";
    if (p.endsWith(".wasm")) return "application/wasm";
    if (p.endsWith(".mjs")) return "text/javascript";
    if (p.endsWith(".onnx") || p.endsWith(".bin")) return "application/octet-stream";
    if (p.endsWith(".traineddata")) return "application/octet-stream";
    if (p.endsWith(".gz")) return "application/gzip";
    if (p.endsWith(".woff")) return "font/woff";
    return "application/octet-stream";
  }
}

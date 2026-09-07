package de.nadena.orvuno;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.amazon.device.iap.PurchasingListener;
import com.amazon.device.iap.PurchasingService;
import com.amazon.device.iap.model.FulfillmentResult;
import com.amazon.device.iap.model.Product;
import com.amazon.device.iap.model.ProductDataResponse;
import com.amazon.device.iap.model.PurchaseResponse;
import com.amazon.device.iap.model.PurchaseUpdatesResponse;
import com.amazon.device.iap.model.Receipt;
import com.amazon.device.iap.model.UserData;
import com.amazon.device.iap.model.UserDataResponse;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity implements PurchasingListener {
    private static final String START_URL = "https://orvuno-worldproject.vercel.app/?app=amazon";
    private static final String APP_HOST = "orvuno-worldproject.vercel.app";
    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSavePassword(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AmazonIapBridge(), "OrvunoAmazonIap");

        PurchasingService.registerListener(getApplicationContext(), this);
        PurchasingService.enablePendingPurchases();
        webView.loadUrl(START_URL);
    }

    @Override protected void onResume() {
        super.onResume();
        PurchasingService.getUserData();
        PurchasingService.getPurchaseUpdates(false);
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("OrvunoAmazonIap");
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    public final class AmazonIapBridge {
        @JavascriptInterface public void purchase(final String sku) {
            runOnUiThread(() -> PurchasingService.purchase(sku));
        }
        @JavascriptInterface public void notifyFulfilled(final String receiptId) {
            runOnUiThread(() -> PurchasingService.notifyFulfillment(receiptId, FulfillmentResult.FULFILLED));
        }
        @JavascriptInterface public void requestProductData(final String jsonSkus) {
            runOnUiThread(() -> {
                try {
                    JSONArray a = new JSONArray(jsonSkus);
                    Set<String> skus = new HashSet<>();
                    for (int i=0;i<a.length();i++) skus.add(a.getString(i));
                    PurchasingService.getProductData(skus);
                } catch (Exception e) { emitError("Produktdaten konnten nicht geladen werden"); }
            });
        }
        @JavascriptInterface public void requestPurchaseUpdates(final boolean reset) {
            runOnUiThread(() -> PurchasingService.getPurchaseUpdates(reset));
        }
        @JavascriptInterface public void requestUserData() {
            runOnUiThread(PurchasingService::getUserData);
        }
    }

    private void emit(String event, JSONObject detail) {
        if (webView == null) return;
        final String js = "window.dispatchEvent(new CustomEvent(" + JSONObject.quote(event) + ",{detail:" + detail.toString() + "}));";
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(js, null); });
    }
    private void emitError(String message) {
        try { JSONObject d=new JSONObject(); d.put("message", message); emit("orvuno:amazon-iap-error", d); } catch(Exception ignored) {}
    }
    private void emitReceipt(Receipt receipt, UserData user) {
        if (receipt==null || user==null || receipt.isCanceled()) return;
        try {
            JSONObject d=new JSONObject();
            d.put("receiptId",receipt.getReceiptId());
            d.put("sku",receipt.getSku());
            d.put("amazonUserId",user.getUserId());
            emit("orvuno:amazon-iap-purchase",d);
        } catch(Exception e){ emitError("Amazon-Kaufdaten konnten nicht verarbeitet werden"); }
    }

    @Override public void onUserDataResponse(UserDataResponse response) {
        if (response.getRequestStatus()!= UserDataResponse.RequestStatus.SUCCESSFUL) {
            emitError("Amazon-Konto ist für In-App-Käufe nicht verfügbar");
            return;
        }
        try {
            JSONObject d=new JSONObject();
            d.put("amazonUserId",response.getUserData().getUserId());
            emit("orvuno:amazon-iap-user",d);
        } catch(Exception ignored) {}
    }

    @Override public void onProductDataResponse(ProductDataResponse response) {
        if (response.getRequestStatus()!= ProductDataResponse.RequestStatus.SUCCESSFUL) { emitError("Amazon-Produktdaten sind nicht verfügbar"); return; }
        try {
            JSONObject products=new JSONObject();
            for (Map.Entry<String, Product> e: response.getProductData().entrySet()) {
                Product p=e.getValue();
                JSONObject d=new JSONObject();
                d.put("price",p.getPrice());
                d.put("title",p.getTitle());
                d.put("type",String.valueOf(p.getProductType()));
                products.put(e.getKey(),d);
            }
            JSONObject root=new JSONObject();
            root.put("products",products);
            emit("orvuno:amazon-iap-products",root);
        } catch(Exception e){ emitError("Amazon-Preise konnten nicht verarbeitet werden"); }
    }

    @Override public void onPurchaseResponse(PurchaseResponse response) {
        switch(response.getRequestStatus()) {
            case SUCCESSFUL: emitReceipt(response.getReceipt(), response.getUserData()); break;
            case PENDING: emitError("Der Amazon-Kauf wartet noch auf Freigabe"); break;
            case ALREADY_PURCHASED: PurchasingService.getPurchaseUpdates(true); break;
            case INVALID_SKU: emitError("Dieses Amazon-Produkt ist nicht verfügbar"); break;
            case NOT_SUPPORTED: emitError("Amazon In-App-Käufe werden auf diesem Gerät nicht unterstützt"); break;
            default: emitError("Amazon-Kauf wurde abgebrochen oder ist fehlgeschlagen");
        }
    }

    @Override public void onPurchaseUpdatesResponse(PurchaseUpdatesResponse response) {
        if(response.getRequestStatus()!= PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL) return;
        for(Receipt receipt: response.getReceipts()) emitReceipt(receipt,response.getUserData());
        if(response.hasMore()) PurchasingService.getPurchaseUpdates(false);
    }
}

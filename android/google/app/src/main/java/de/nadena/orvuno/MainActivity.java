package de.nadena.orvuno;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity implements PurchasesUpdatedListener {
    private static final String START_URL = "https://orvuno-worldproject.vercel.app/?source=app&orvuno_app=android&orvuno_store=google&native_billing=1";
    private static final String TRUSTED_HOST = "orvuno-worldproject.vercel.app";
    private static final List<String> PLAY_SKUS = Arrays.asList(
        "orvuno_coins_100", "orvuno_coins_550", "orvuno_coins_1200", "orvuno_coins_2600",
        "orvuno_coins_6000", "orvuno_coins_13000", "orvuno_coins_26000", "orvuno_coins_50000",
        "orvuno_premium_1m", "orvuno_premium_3m", "orvuno_premium_6m", "orvuno_premium_12m"
    );

    private WebView webView;
    private BillingClient billingClient;
    private boolean billingReady = false;
    private final Map<String, ProductDetails> productCache = new LinkedHashMap<>();

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        configureWebView();
        configureBilling();
        webView.loadUrl(START_URL);
    }

    private void configureWebView() {
        webView = new WebView(this);
        setContentView(webView);
        webView.setBackgroundColor(Color.rgb(15,18,24));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(new GooglePlayBridge(), "OrvunoGooglePlay");
        webView.addJavascriptInterface(new GooglePlayBridge(), "OrvunoGoogleBilling");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request == null ? null : request.getUrl();
                if (uri == null || uri.getHost() == null) return true;
                return !"https".equalsIgnoreCase(uri.getScheme()) || !TRUSTED_HOST.equalsIgnoreCase(uri.getHost());
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                sendReady();
                if (billingReady) {
                    queryProducts();
                    queryOwnedPurchases();
                }
            }
        });
    }

    private void configureBilling() {
        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        connectBilling();
    }

    private void connectBilling() {
        if (billingClient == null || billingClient.isReady()) {
            billingReady = billingClient != null && billingClient.isReady();
            if (billingReady) onBillingReady();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                billingReady = result.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (billingReady) onBillingReady();
                else sendBillingStatus("SETUP_FAILED", result);
            }
            @Override public void onBillingServiceDisconnected() {
                billingReady = false;
                sendBillingStatus("DISCONNECTED", null);
            }
        });
    }

    private void onBillingReady() {
        sendReady();
        queryProducts();
        queryOwnedPurchases();
    }

    private void sendReady() {
        JSONObject detail = new JSONObject();
        try { detail.put("ready", billingReady); detail.put("billingVersion", "9.1.0"); }
        catch (Exception ignored) {}
        sendEvent("orvuno:google-play-ready", detail);
    }

    private QueryProductDetailsParams productQueryParams() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String sku : PLAY_SKUS) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }
        return QueryProductDetailsParams.newBuilder().setProductList(products).build();
    }

    private void queryProducts() {
        if (!ensureBilling()) return;
        billingClient.queryProductDetailsAsync(productQueryParams(), (BillingResult result, QueryProductDetailsResult queryResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                sendBillingStatus("PRODUCT_QUERY_FAILED", result);
                return;
            }
            productCache.clear();
            JSONArray products = new JSONArray();
            for (ProductDetails p : queryResult.getProductDetailsList()) {
                productCache.put(p.getProductId(), p);
                JSONObject item = new JSONObject();
                try {
                    item.put("productId", p.getProductId());
                    item.put("title", p.getName());
                    item.put("description", p.getDescription());
                    ProductDetails.OneTimePurchaseOfferDetails offer = selectedOffer(p);
                    if (offer != null) {
                        item.put("formattedPrice", offer.getFormattedPrice());
                        item.put("priceCurrencyCode", offer.getPriceCurrencyCode());
                        item.put("priceAmountMicros", offer.getPriceAmountMicros());
                        item.put("offerToken", offer.getOfferToken());
                    }
                    products.put(item);
                } catch (Exception ignored) {}
            }
            JSONObject payload = new JSONObject();
            try { payload.put("products", products); payload.put("count", products.length()); }
            catch (Exception ignored) {}
            sendEvent("orvuno:google-play-products", payload);
        });
    }

    private ProductDetails.OneTimePurchaseOfferDetails selectedOffer(ProductDetails p) {
        try {
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = p.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty()) return offers.get(0);
        } catch (Throwable ignored) {}
        try { return p.getOneTimePurchaseOfferDetails(); }
        catch (Throwable ignored) { return null; }
    }

    private void purchase(String sku) {
        if (!PLAY_SKUS.contains(sku)) { sendSimpleError("UNKNOWN_SKU", sku, "Unbekannte Google-Play-Produkt-ID."); return; }
        if (!ensureBilling()) return;
        ProductDetails product = productCache.get(sku);
        if (product == null) {
            queryProducts();
            sendSimpleError("PRODUCT_NOT_READY", sku, "Google-Play-Produktdaten werden noch geladen. Bitte erneut versuchen.");
            return;
        }
        BillingFlowParams.ProductDetailsParams.Builder pd = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
        ProductDetails.OneTimePurchaseOfferDetails offer = selectedOffer(product);
        if (offer != null && offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) pd.setOfferToken(offer.getOfferToken());
        BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(Arrays.asList(pd.build())).build();
        BillingResult result = billingClient.launchBillingFlow(this, params);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) sendBillingStatus("LAUNCH_FAILED", result);
    }

    private boolean ensureBilling() {
        if (billingClient != null && billingClient.isReady()) { billingReady = true; return true; }
        billingReady = false;
        connectBilling();
        sendSimpleError("BILLING_NOT_READY", "", "Google Play Billing verbindet sich noch. Bitte erneut versuchen.");
        return false;
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) sendPurchase(purchase, "PURCHASED");
            return;
        }
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            sendBillingStatus("USER_CANCELED", result);
            return;
        }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            queryOwnedPurchases();
            sendBillingStatus("ITEM_ALREADY_OWNED", result);
            return;
        }
        sendBillingStatus("PURCHASE_FAILED", result);
    }

    private void queryOwnedPurchases() {
        if (!ensureBilling()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        billingClient.queryPurchasesAsync(params, (BillingResult result, List<Purchase> purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                sendBillingStatus("RESTORE_FAILED", result);
                return;
            }
            for (Purchase purchase : purchases) sendPurchase(purchase, "RESTORED");
            JSONObject payload = new JSONObject();
            try { payload.put("count", purchases == null ? 0 : purchases.size()); }
            catch (Exception ignored) {}
            sendEvent("orvuno:google-play-restore-complete", payload);
        });
    }

    private void sendPurchase(Purchase purchase, String source) {
        if (purchase == null) return;
        JSONObject payload = new JSONObject();
        try {
            JSONArray products = new JSONArray();
            for (String p : purchase.getProducts()) products.put(p);
            payload.put("products", products);
            payload.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
            payload.put("purchaseToken", purchase.getPurchaseToken());
            payload.put("orderId", purchase.getOrderId() == null ? "" : purchase.getOrderId());
            payload.put("purchaseState", purchase.getPurchaseState());
            payload.put("acknowledged", purchase.isAcknowledged());
            payload.put("quantity", purchase.getQuantity());
            payload.put("source", source);
        } catch (Exception ignored) {}
        sendEvent("orvuno:google-play-purchase", payload);
    }

    private void sendBillingStatus(String stage, BillingResult result) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("stage", stage);
            payload.put("code", result == null ? -1 : result.getResponseCode());
            payload.put("message", result == null ? "" : result.getDebugMessage());
        } catch (Exception ignored) {}
        sendEvent("orvuno:google-play-error", payload);
    }

    private void sendSimpleError(String stage, String sku, String message) {
        JSONObject payload = new JSONObject();
        try { payload.put("stage", stage); payload.put("sku", sku); payload.put("message", message); }
        catch (Exception ignored) {}
        sendEvent("orvuno:google-play-error", payload);
    }

    private void sendEvent(String name, JSONObject detail) {
        if (webView == null) return;
        final String n = JSONObject.quote(name);
        final String d = detail == null ? "{}" : detail.toString();
        webView.post(() -> webView.evaluateJavascript("window.dispatchEvent(new CustomEvent(" + n + ",{detail:" + d + "}));", null));
    }

    @Override protected void onResume() {
        super.onResume();
        if (billingClient != null && billingClient.isReady()) queryOwnedPurchases(); else connectBilling();
    }

    @Override protected void onDestroy() {
        if (billingClient != null) billingClient.endConnection();
        if (webView != null) { webView.removeAllViews(); webView.destroy(); }
        super.onDestroy();
    }

    private final class GooglePlayBridge {
        @JavascriptInterface public boolean isReady() { return billingClient != null && billingClient.isReady(); }
        @JavascriptInterface public void purchase(String sku) { runOnUiThread(() -> MainActivity.this.purchase(sku == null ? "" : sku.trim())); }
        @JavascriptInterface public void queryProducts() { runOnUiThread(MainActivity.this::queryProducts); }
        @JavascriptInterface public void restorePurchases() { runOnUiThread(MainActivity.this::queryOwnedPurchases); }
        @JavascriptInterface public String billingVersion() { return "9.1.0"; }
    }
}

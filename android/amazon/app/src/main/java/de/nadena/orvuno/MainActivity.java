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

import com.amazon.device.iap.PurchasingListener;
import com.amazon.device.iap.PurchasingService;
import com.amazon.device.iap.model.FulfillmentResult;
import com.amazon.device.iap.model.Product;
import com.amazon.device.iap.model.ProductDataResponse;
import com.amazon.device.iap.model.PurchaseResponse;
import com.amazon.device.iap.model.PurchaseUpdatesResponse;
import com.amazon.device.iap.model.Receipt;
import com.amazon.device.iap.model.UserDataResponse;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity {
    private static final String START_URL="https://orvuno-worldproject.vercel.app/?source=app&orvuno_app=android&orvuno_store=amazon";
    private static final Set<String> AMAZON_SKUS=new LinkedHashSet<>(Arrays.asList(
        "orvuno_coins_100","orvuno_coins_550","orvuno_coins_1200","orvuno_coins_2600",
        "orvuno_coins_6000","orvuno_coins_13000","orvuno_coins_26000","orvuno_coins_50000",
        "orvuno_premium_4w","orvuno_premium_3m","orvuno_premium_6m","orvuno_premium_12m"
    ));
    private WebView webView;

    private final PurchasingListener purchasingListener=new PurchasingListener(){
        @Override public void onUserDataResponse(UserDataResponse response){
            if(response!=null&&response.getRequestStatus()==UserDataResponse.RequestStatus.SUCCESSFUL){
                requestProductsNative();
                sendEvent("orvuno:amazon-iap-user",new JSONObject());
            } else sendError("Amazon-Benutzerdaten konnten nicht geladen werden.");
        }
        @Override public void onProductDataResponse(ProductDataResponse response){
            JSONObject products=new JSONObject();
            try{
                if(response!=null&&response.getRequestStatus()==ProductDataResponse.RequestStatus.SUCCESSFUL){
                    for(Map.Entry<String,Product> entry:response.getProductData().entrySet()){
                        Product p=entry.getValue(); if(p==null)continue;
                        JSONObject item=new JSONObject(); item.put("sku",p.getSku()); item.put("title",p.getTitle()); item.put("description",p.getDescription()); item.put("price",p.getPrice()); item.put("productType",String.valueOf(p.getProductType()));
                        products.put(p.getSku(),item);
                    }
                }
                JSONObject detail=new JSONObject(); detail.put("products",products); sendEvent("orvuno:amazon-iap-products",detail);
            }catch(Exception e){sendError("Amazon-Produktdaten konnten nicht verarbeitet werden.");}
        }
        @Override public void onPurchaseResponse(PurchaseResponse response){
            if(response==null||response.getRequestStatus()==null){sendError("Amazon-Kauf fehlgeschlagen.");return;}
            switch(response.getRequestStatus()){
                case SUCCESSFUL:
                    try{sendReceipt(response.getUserData()==null?"":response.getUserData().getUserId(),response.getReceipt());}catch(Exception e){sendError("Amazon-Kaufdaten sind unvollständig.");}
                    break;
                case ALREADY_PURCHASED: PurchasingService.getPurchaseUpdates(true); break;
                case PENDING: sendError("Amazon-Kauf wartet auf Bestätigung."); break;
                case INVALID_SKU: sendError("Amazon meldet eine ungültige Produkt-ID."); requestProductsNative(); break;
                case NOT_SUPPORTED: sendError("Amazon In-App Purchasing wird auf diesem Gerät nicht unterstützt."); break;
                default: sendError("Amazon-Kauf wurde nicht abgeschlossen.");
            }
        }
        @Override public void onPurchaseUpdatesResponse(PurchaseUpdatesResponse response){
            if(response==null||response.getRequestStatus()!=PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL)return;
            String uid=response.getUserData()==null?"":response.getUserData().getUserId();
            for(Receipt receipt:response.getReceipts())if(receipt!=null&&!receipt.isCanceled())sendReceipt(uid,receipt);
            if(response.hasMore())PurchasingService.getPurchaseUpdates(false);
        }
    };

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        PurchasingService.registerListener(getApplicationContext(),purchasingListener);
        try{PurchasingService.enablePendingPurchases();}catch(Throwable ignored){}
        webView=new WebView(this); setContentView(webView); webView.setBackgroundColor(Color.rgb(15,18,24));
        WebSettings s=webView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(new AmazonBridge(),"OrvunoAmazonIap");
        webView.addJavascriptInterface(new AmazonBridge(),"OrvunoAmazonIAP");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri u=request==null?null:request.getUrl();return u!=null&&u.getHost()!=null&&!"orvuno-worldproject.vercel.app".equalsIgnoreCase(u.getHost());}
            @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);refreshAmazon();}
        });
        webView.loadUrl(START_URL);
    }
    @Override protected void onResume(){super.onResume();refreshAmazon();}

    private void refreshAmazon(){try{PurchasingService.getUserData();}catch(Throwable ignored){} try{requestProductsNative();}catch(Throwable ignored){} try{PurchasingService.getPurchaseUpdates(false);}catch(Throwable ignored){}}
    private void requestProductsNative(){try{PurchasingService.getProductData(new LinkedHashSet<>(AMAZON_SKUS));}catch(Throwable t){sendError("Amazon-Produktkatalog konnte nicht geladen werden.");}}
    private void sendReceipt(String uid,Receipt receipt){if(receipt==null)return;try{JSONObject d=new JSONObject();d.put("amazonUserId",uid==null?"":uid);d.put("receiptId",receipt.getReceiptId());d.put("sku",receipt.getSku());d.put("canceled",receipt.isCanceled());d.put("sandbox",BuildConfig.AMAZON_IAP_SANDBOX);sendEvent("orvuno:amazon-iap-purchase",d);}catch(Exception e){sendError("Amazon-Beleg konnte nicht verarbeitet werden.");}}
    private void sendError(String message){try{JSONObject d=new JSONObject();d.put("message",message);sendEvent("orvuno:amazon-iap-error",d);}catch(Exception ignored){}}
    private void sendEvent(String name,JSONObject detail){if(webView==null)return;final String n=JSONObject.quote(name),d=detail==null?"{}":detail.toString();webView.post(()->webView.evaluateJavascript("window.dispatchEvent(new CustomEvent("+n+",{detail:"+d+"}));",null));}

    private final class AmazonBridge {
        @JavascriptInterface public void purchase(String sku){if(sku==null||!AMAZON_SKUS.contains(sku)){sendError("Unbekannte Amazon-Produkt-ID.");return;}runOnUiThread(()->{try{PurchasingService.purchase(sku);}catch(Throwable t){sendError("Amazon-Kauf konnte nicht geöffnet werden.");}});}
        @JavascriptInterface public void requestProductData(String ignored){runOnUiThread(MainActivity.this::requestProductsNative);}
        @JavascriptInterface public void requestProducts(){runOnUiThread(MainActivity.this::requestProductsNative);}
        @JavascriptInterface public void requestPurchaseUpdates(boolean reset){runOnUiThread(()->PurchasingService.getPurchaseUpdates(reset));}
        @JavascriptInterface public void requestPurchaseUpdates(){runOnUiThread(()->PurchasingService.getPurchaseUpdates(false));}
        @JavascriptInterface public void notifyFulfilled(String receiptId){if(receiptId==null||receiptId.trim().isEmpty())return;runOnUiThread(()->PurchasingService.notifyFulfillment(receiptId,FulfillmentResult.FULFILLED));}
        @JavascriptInterface public void fulfill(String receiptId){notifyFulfilled(receiptId);}
    }
}

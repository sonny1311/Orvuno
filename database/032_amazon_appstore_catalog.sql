-- Amazon Appstore publishes orvuno_premium_4w as the 3.99 EUR short premium package.
-- The web/Google catalog can continue using premium_1m; Amazon maps that visible offer to this 28-day entitlement.
update public.store_products
set active=true
where sku='premium_4w';

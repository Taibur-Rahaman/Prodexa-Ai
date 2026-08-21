=== Prodexa AI ===
Contributors: prodexa
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.2
Stable tag: 0.1.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress client for the hosted Prodexa product-discovery API.

== Description ==

Prodexa AI connects a merchant WordPress/WooCommerce site to the hosted Prodexa API.

This plugin is a client only. Licensing, authorization, tenant state, discovery, connectors, ranking, and pricing remain on the Prodexa backend.

This release includes:

* Plugin bootstrap and safe activation/deactivation
* Admin settings for API base URL, site ID, and sealed site credentials
* Signed HTTP client (HMAC-SHA256, DEC-018)
* GET /v1/health connectivity check
* License status refresh via POST /v1/license/validate (display only)
* Storefront `[prodexa_search]` UI that proxies POST /v1/discovery/search (secrets stay on the server)

Not included yet: WooCommerce checkout metadata, product sync, connectors, or AI features.

== Installation ==

1. Copy `prodexa-ai` into `wp-content/plugins/`.
2. Activate the plugin.
3. Open Settings → Prodexa AI.
4. Set the API base URL (local default `http://localhost:8000`).
5. Enter the site ID and site secret issued by Prodexa.
6. Add the `[prodexa_search]` shortcode to a page for storefront discovery.

Do not deploy this plugin onto the apex WordPress tree on prodexaai.cloud without human authorization. That install is not this plugin.

== Frequently Asked Questions ==

= Does a stored license key unlock discovery? =

No. The Prodexa API is authoritative. Cached status in WordPress is an operator display only.

= Where is the site secret stored? =

On the merchant WordPress server, encrypted with keys derived from WordPress salts. It is never sent to browsers.

== Changelog ==

= 0.1.1 =
* Storefront discovery search shortcode and AJAX proxy for POST /v1/discovery/search.

= 0.1.0 =
* Plugin foundation: settings, HMAC HTTP client, health check, license boundary.

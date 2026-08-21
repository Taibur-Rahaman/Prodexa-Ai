<?php
/**
 * Storefront shortcode, AJAX nonce, HMAC proxy, and secret non-exposure.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

Prodexa_AI_Test_State::reset();
Prodexa_AI_Activator::activate();
update_option(Prodexa_AI_Settings::OPTION_SETTINGS, [
    'backend_url' => 'http://localhost:8000',
    'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    'timeout' => 5,
]);
update_option(Prodexa_AI_Settings::OPTION_SECRETS, [
    'site_secret' => Prodexa_AI_Secrets::seal('must-never-render'),
    'license_key' => Prodexa_AI_Secrets::seal('license-must-never-render'),
]);

$settings = new Prodexa_AI_Settings();
$signed_args = [];
$client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args) use (&$signed_args): array {
    $signed_args = $args;
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/discovery/search', $url, 'AJAX search proxies discovery');
    $body = json_decode((string) $args['body'], true);
    Prodexa_AI_Test_Case::assert_true(is_array($body), 'proxied body is JSON');
    Prodexa_AI_Test_Case::assert_same('bata gift card', $body['query'] ?? null, 'proxied query matches');
    Prodexa_AI_Test_Case::assert_same(1, $body['page'] ?? null, 'proxied page is an integer');
    Prodexa_AI_Test_Case::assert_false(isset($body['tenant_id']), 'proxy does not send tenant_id');
    Prodexa_AI_Test_Case::assert_false(isset($body['source_url']), 'proxy does not send source_url');

    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_storefront'],
        'body' => json_encode([
            'request_id' => 'req_storefront',
            'results' => [
                [
                    'offer_id' => 'off_1',
                    'title' => '<img src=x onerror=alert(1)>Bata gift card',
                    'image_url' => 'https://cdn.example.com/card.jpg',
                    'display_price' => 1000,
                    'currency' => 'BDT',
                    'availability' => 'in_stock',
                    'freshness' => ['retrieved_at' => '2026-08-21T00:00:00Z'],
                    'source_url' => 'https://secret.example/hidden',
                ],
            ],
            'meta' => ['cached' => false, 'count' => 1],
        ], JSON_THROW_ON_ERROR),
    ];
});
$storefront = new Prodexa_AI_Storefront($settings, $client);
$storefront->register();

$t::assert_true(isset(Prodexa_AI_Test_State::$shortcodes['prodexa_search']), 'shortcode is registered');
$t::assert_true(isset(Prodexa_AI_Test_State::$actions['wp_ajax_prodexa_ai_search']), 'logged-in AJAX is registered');
$t::assert_true(isset(Prodexa_AI_Test_State::$actions['wp_ajax_nopriv_prodexa_ai_search']), 'logged-out AJAX is registered');
$t::assert_true(isset(Prodexa_AI_Test_State::$actions['wp_ajax_prodexa_ai_select']), 'logged-in select AJAX is registered');
$t::assert_true(isset(Prodexa_AI_Test_State::$actions['wp_ajax_nopriv_prodexa_ai_select']), 'logged-out select AJAX is registered');

$html = $storefront->render_shortcode(['limit' => '10']);
$t::assert_true(str_contains($html, 'data-prodexa-search'), 'shortcode renders search root');
$t::assert_true(str_contains($html, 'type="search"'), 'shortcode renders search input');
$t::assert_false(str_contains($html, 'must-never-render'), 'shortcode HTML has no site secret');
$t::assert_false(str_contains($html, 'license-must-never-render'), 'shortcode HTML has no license key');
$t::assert_false(str_contains($html, 'x-prodexa-signature'), 'shortcode HTML has no HMAC header');

$localized = Prodexa_AI_Test_State::$localized['prodexa-ai-search']['data'] ?? [];
$t::assert_same(['ajaxUrl', 'nonce', 'action', 'selectAction', 'i18n'], array_keys($localized), 'localized script data is an allowlist');
$t::assert_same('prodexa_ai_search', $localized['action'] ?? null, 'localized action matches AJAX');
$t::assert_same('prodexa_ai_select', $localized['selectAction'] ?? null, 'localized select action matches AJAX');
$encoded_l10n = json_encode($localized);
$t::assert_false(is_string($encoded_l10n) && str_contains($encoded_l10n, 'must-never-render'), 'localized JS has no site secret');
$t::assert_false(is_string($encoded_l10n) && str_contains($encoded_l10n, 'x-prodexa-signature'), 'localized JS has no HMAC');
$t::assert_false(isset($localized['site_secret']) || isset($localized['license_key']), 'localized JS has no credential keys');

Prodexa_AI_Test_State::$can_manage = false;
$_POST = [
    'action' => Prodexa_AI_Storefront::AJAX_ACTION,
    'nonce' => wp_create_nonce(Prodexa_AI_Storefront::NONCE_ACTION),
    'query' => 'bata gift card',
    'page' => '1',
    'limit' => '10',
];
$_REQUEST = $_POST;
$ok = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $storefront->handle_search());
$t::assert_same('json', $ok['type'], 'storefront search does not require manage_options');
$t::assert_true(($ok['payload']['response']['success'] ?? false) === true, 'successful search returns success');
$payload = $ok['payload']['response']['data'] ?? [];
$t::assert_same('req_storefront', $payload['request_id'] ?? null, 'request id is returned');
$t::assert_same('Bata gift card', $payload['results'][0]['title'] ?? null, 'HTML is stripped from titles before JSON');
$t::assert_false(isset($payload['results'][0]['source_url']), 'AJAX JSON omits source_url');
$t::assert_true(isset($signed_args['headers']['x-prodexa-signature']), 'PHP client signs the upstream search');
$t::assert_false(str_contains(json_encode($ok['payload']) ?: '', 'must-never-render'), 'AJAX JSON has no site secret');
$t::assert_false(str_contains(json_encode($ok['payload']) ?: '', 'secret.example'), 'AJAX JSON has no private source URL');

$_POST['nonce'] = 'bad-nonce';
$_REQUEST = $_POST;
$denied = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $storefront->handle_search());
$t::assert_same('die', $denied['type'], 'invalid storefront nonce is rejected');
$t::assert_true(str_contains($denied['message'] ?? '', 'wp_die:403'), 'invalid nonce is 403');

$_POST['nonce'] = wp_create_nonce(Prodexa_AI_Storefront::NONCE_ACTION);
$_POST['query'] = '';
$_REQUEST = $_POST;
$invalid = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $storefront->handle_search());
$t::assert_true(($invalid['payload']['response']['success'] ?? true) === false, 'empty query is an error state');
$t::assert_same('VALIDATION_ERROR', $invalid['payload']['response']['data']['code'] ?? null, 'empty query code');

$empty_client = new Prodexa_AI_Api_Client($settings, static function (): array {
    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_empty'],
        'body' => '{"request_id":"req_empty","results":[],"meta":{"cached":false,"count":0}}',
    ];
});
$empty_ui = new Prodexa_AI_Storefront($settings, $empty_client);
$_POST['query'] = 'no matches here';
$_REQUEST = $_POST;
$empty = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $empty_ui->handle_search());
$t::assert_true(($empty['payload']['response']['success'] ?? false) === true, 'empty results are success');
$t::assert_same(0, $empty['payload']['response']['data']['meta']['count'] ?? null, 'empty meta.count is 0');

$license_client = new Prodexa_AI_Api_Client($settings, static function (): array {
    return [
        'response' => ['code' => 403],
        'headers' => ['x-request-id' => 'req_quota'],
        'body' => json_encode([
            'error' => [
                'code' => 'USAGE_LIMIT_EXCEEDED',
                'message' => 'Daily search quota exhausted.',
                'request_id' => 'req_quota',
            ],
        ], JSON_THROW_ON_ERROR),
    ];
});
$error_ui = new Prodexa_AI_Storefront($settings, $license_client);
$errored = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $error_ui->handle_search());
$t::assert_true(($errored['payload']['response']['success'] ?? true) === false, 'quota errors are an error state');
$t::assert_same('USAGE_LIMIT_EXCEEDED', $errored['payload']['response']['data']['code'] ?? null, 'quota error code preserved');
$t::assert_same('req_quota', $errored['payload']['response']['data']['request_id'] ?? null, 'quota request id preserved');

$js = (string) file_get_contents(dirname(__DIR__) . '/assets/js/search.js');
$t::assert_false(str_contains($js, 'innerHTML'), 'storefront JS does not assign innerHTML');
$t::assert_true(str_contains($js, 'textContent'), 'storefront JS renders with textContent');
$t::assert_false(preg_match('/site_secret|license_key|x-prodexa-signature/i', $js) === 1, 'storefront JS has no HMAC or license keys');
$t::assert_true(str_contains($js, 'offer_id'), 'storefront JS submits offer_id for select');
$t::assert_false(str_contains($js, 'body.set("selection_id"'), 'storefront JS does not submit selection_id');
$t::assert_false(str_contains($js, 'body.set("tenant_id"'), 'storefront JS does not submit tenant_id');
$t::assert_false(str_contains($js, 'body.set("display_price"'), 'storefront JS does not submit display_price');

$select_session = new Prodexa_AI_Test_Session();
$select_headers = [];
$select_client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args) use (&$select_headers): array {
    $select_headers = $args['headers'];
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/discovery/select', $url, 'AJAX select proxies discovery select');
    $body = json_decode((string) $args['body'], true);
    Prodexa_AI_Test_Case::assert_true(is_array($body), 'select body is JSON');
    Prodexa_AI_Test_Case::assert_same(
        'off_00000000-0000-4000-8000-000000000001',
        $body['offer_id'] ?? null,
        'select forwards sanitized offer_id'
    );
    Prodexa_AI_Test_Case::assert_true(
        is_string($body['selection_id'] ?? null) && str_starts_with((string) $body['selection_id'], 'sel_'),
        'PHP mints selection_id'
    );
    Prodexa_AI_Test_Case::assert_false(isset($body['tenant_id']), 'select proxy does not send tenant_id');
    Prodexa_AI_Test_Case::assert_false(isset($body['display_price']), 'select proxy does not send price');
    $expected = Prodexa_AI_Hmac::sign('must-never-render', [
        'method' => 'POST',
        'path' => '/v1/discovery/select',
        'timestamp' => $args['headers']['x-prodexa-timestamp'],
        'nonce' => $args['headers']['x-prodexa-nonce'],
        'body' => $args['body'],
        'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    ]);
    Prodexa_AI_Test_Case::assert_same($expected, $args['headers']['x-prodexa-signature'], 'PHP client signs the upstream select');

    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_select'],
        'body' => json_encode([
            'selection_id' => $body['selection_id'],
            'offer_id' => $body['offer_id'],
            'expires_at' => '2026-08-21T00:15:00.000Z',
            'tenant_id' => 'ten_private',
            'source_url' => 'https://secret.example/hidden',
        ], JSON_THROW_ON_ERROR),
    ];
});
$select_ui = new Prodexa_AI_Storefront($settings, $select_client, new Prodexa_AI_WooCommerce($select_client, $select_session));
$_POST = [
    'action' => Prodexa_AI_Storefront::SELECT_ACTION,
    'nonce' => wp_create_nonce(Prodexa_AI_Storefront::NONCE_ACTION),
    'offer_id' => 'off_00000000-0000-4000-8000-000000000001',
    'selection_id' => 'client-supplied-selection',
    'tenant_id' => 'ten_injected',
    'display_price' => '999',
];
$_REQUEST = $_POST;
$selected = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $select_ui->handle_select());
$t::assert_true(($selected['payload']['response']['success'] ?? false) === true, 'successful select returns success');
$select_payload = $selected['payload']['response']['data'] ?? [];
$t::assert_same(
    ['selection_id', 'offer_id', 'expires_at', 'request_id'],
    is_array($select_payload) ? array_keys($select_payload) : [],
    'select AJAX returns only customer-safe keys'
);
$t::assert_false(isset($select_payload['tenant_id']), 'select AJAX omits tenant_id');
$t::assert_false(isset($select_payload['source_url']), 'select AJAX omits source_url');
$t::assert_true(isset($select_headers['x-prodexa-signature']), 'select request is HMAC signed');
$t::assert_false(str_contains(json_encode($selected['payload']) ?: '', 'must-never-render'), 'select AJAX JSON has no site secret');
$t::assert_false(str_contains(json_encode($selected['payload']) ?: '', 'secret.example'), 'select AJAX JSON has no private source URL');
$pending = $select_session->get(Prodexa_AI_WooCommerce::SESSION_KEY);
$t::assert_true(is_array($pending), 'select stores a pending session selection');
$t::assert_same($select_payload['selection_id'] ?? null, is_array($pending) ? ($pending['selection_id'] ?? null) : null, 'session selection_id matches API');
$t::assert_false(isset($pending['display_price']), 'session does not store client price');

$_POST['nonce'] = 'bad-nonce';
$_REQUEST = $_POST;
$select_denied = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $select_ui->handle_select());
$t::assert_same('die', $select_denied['type'], 'invalid select nonce is rejected');
$t::assert_true(str_contains($select_denied['message'] ?? '', 'wp_die:403'), 'invalid select nonce is 403');

$_POST['nonce'] = wp_create_nonce(Prodexa_AI_Storefront::NONCE_ACTION);
$_POST['offer_id'] = 'not-an-offer';
$_REQUEST = $_POST;
$select_invalid = Prodexa_AI_Test_Case::capture_wp_response(static fn () => $select_ui->handle_select());
$t::assert_true(($select_invalid['payload']['response']['success'] ?? true) === false, 'invalid offer_id is an error state');
$t::assert_same('VALIDATION_ERROR', $select_invalid['payload']['response']['data']['code'] ?? null, 'invalid offer_id code');

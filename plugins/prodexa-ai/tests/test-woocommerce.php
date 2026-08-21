<?php
/**
 * WooCommerce selection metadata: validate before persist, tenant isolation, no trusted client meta.
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
    'site_secret' => Prodexa_AI_Secrets::seal('site-secret'),
    'license_key' => '',
]);
$settings = new Prodexa_AI_Settings();

$valid_selection = [
    'selection_id' => 'sel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'offer_id' => 'off_00000000-0000-4000-8000-000000000001',
    'expires_at' => '2026-08-21T00:15:00.000Z',
];

$select_calls = [];
$valid_client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args) use (&$select_calls, $valid_selection): array {
    $select_calls[] = $url;
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/discovery/select', $url, 'order attach replays POST /v1/discovery/select');
    $body = json_decode((string) $args['body'], true);
    Prodexa_AI_Test_Case::assert_true(is_array($body), 'revalidate body is JSON');
    Prodexa_AI_Test_Case::assert_same($valid_selection['offer_id'], $body['offer_id'] ?? null, 'revalidate uses session offer_id');
    Prodexa_AI_Test_Case::assert_same($valid_selection['selection_id'], $body['selection_id'] ?? null, 'revalidate uses session selection_id');
    Prodexa_AI_Test_Case::assert_false(isset($body['tenant_id']), 'revalidate does not send tenant_id');
    Prodexa_AI_Test_Case::assert_false(isset($body['display_price']), 'revalidate does not send price');
    $expected = Prodexa_AI_Hmac::sign('site-secret', [
        'method' => 'POST',
        'path' => '/v1/discovery/select',
        'timestamp' => $args['headers']['x-prodexa-timestamp'],
        'nonce' => $args['headers']['x-prodexa-nonce'],
        'body' => $args['body'],
        'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    ]);
    Prodexa_AI_Test_Case::assert_same($expected, $args['headers']['x-prodexa-signature'], 'revalidate HMAC matches body');

    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_select_ok'],
        'body' => json_encode($valid_selection, JSON_THROW_ON_ERROR),
    ];
});

$session = new Prodexa_AI_Test_Session();
$woocommerce = new Prodexa_AI_WooCommerce($valid_client, $session);
$woocommerce->register();
$t::assert_true(
    isset(Prodexa_AI_Test_State::$actions['woocommerce_checkout_create_order']),
    'classic checkout create-order hook is registered'
);
$t::assert_true(
    isset(Prodexa_AI_Test_State::$actions['woocommerce_store_api_checkout_update_order_from_request']),
    'store API checkout hook is registered'
);

$remembered = $woocommerce->remember_pending(array_merge($valid_selection, [
    'tenant_id' => 'ten_injected',
    'display_price' => 12.34,
]));
$t::assert_true($remembered, 'validated selection is stored in session');
$t::assert_same(
    ['selection_id', 'offer_id', 'expires_at'],
    array_keys($session->store[Prodexa_AI_WooCommerce::SESSION_KEY]),
    'session pending selection drops untrusted extra fields'
);

$order = new Prodexa_AI_Test_Order();
$order->update_meta_data('_prodexa_price', '999');
$order->update_meta_data('_prodexa_tenant_id', 'ten_injected');
$order->update_meta_data('prodexa_selection_id', 'client-supplied');
$woocommerce->attach_selection_to_order($order, [
    '_prodexa_selection_id' => 'from-checkout-post',
    'prodexa_price' => '50',
]);
$t::assert_same(1, count($select_calls), 'valid attach calls the API once');
$t::assert_same($valid_selection['selection_id'], $order->meta['_prodexa_selection_id'] ?? null, 'valid selection_id is persisted');
$t::assert_same($valid_selection['expires_at'], $order->meta['_prodexa_selection_expires_at'] ?? null, 'expires_at is persisted from API');
$t::assert_false(isset($order->meta['_prodexa_offer_id']), 'offer_id is not trusted order meta');
$t::assert_false(isset($order->meta['_prodexa_price']), 'client price meta is stripped');
$t::assert_false(isset($order->meta['_prodexa_tenant_id']), 'client tenant meta is stripped');
$t::assert_false(isset($order->meta['prodexa_selection_id']), 'unprefixed client selection meta is stripped');
$t::assert_true(
    $session->get(Prodexa_AI_WooCommerce::SESSION_KEY) === null,
    'pending selection is cleared after a valid attach'
);

$posted = $woocommerce->strip_posted_data([
    'billing_email' => 'buyer@example.com',
    '_prodexa_selection_id' => 'posted-selection',
    'prodexa_price' => '1',
    'prodexa_tenant_id' => 'ten_x',
]);
$t::assert_same(['billing_email' => 'buyer@example.com'], $posted, 'posted checkout data cannot inject Prodexa fields');
$t::assert_true($woocommerce->protect_meta(false, '_prodexa_selection_id'), 'selection meta is protected');
$t::assert_false($woocommerce->protect_meta(false, '_billing_email'), 'unrelated meta protection is unchanged');

$empty_session = new Prodexa_AI_Test_Session();
$no_call_client = new Prodexa_AI_Api_Client($settings, static function (): array {
    Prodexa_AI_Test_Case::assert_true(false, 'orders without a pending selection must not call select');

    return ['response' => ['code' => 500], 'body' => '{}'];
});
$plain = new Prodexa_AI_WooCommerce($no_call_client, $empty_session);
$plain_order = new Prodexa_AI_Test_Order();
$plain->attach_selection_to_order($plain_order, []);
$t::assert_same([], $plain_order->meta, 'normal WooCommerce orders stay untouched');

function prodexa_ai_error_client(Prodexa_AI_Settings $settings, int $status, string $code, string $message): Prodexa_AI_Api_Client
{
    return new Prodexa_AI_Api_Client($settings, static function () use ($status, $code, $message): array {
        return [
            'response' => ['code' => $status],
            'headers' => ['x-request-id' => 'req_err'],
            'body' => json_encode([
                'error' => [
                    'code' => $code,
                    'message' => $message,
                    'request_id' => 'req_err',
                ],
            ], JSON_THROW_ON_ERROR),
        ];
    });
}

function prodexa_ai_assert_failed_attach(
    Prodexa_AI_WooCommerce $woocommerce,
    array $pending,
    string $expected_code,
    string $label,
): void {
    $woocommerce->remember_pending($pending);
    $order = new Prodexa_AI_Test_Order();
    $order->update_meta_data('_prodexa_price', '111');
    $thrown = null;
    try {
        $woocommerce->attach_selection_to_order($order, ['_prodexa_selection_id' => 'ignore-me']);
    } catch (Prodexa_AI_Checkout_Exception $exception) {
        $thrown = $exception;
    }
    Prodexa_AI_Test_Case::assert_true($thrown instanceof Prodexa_AI_Checkout_Exception, $label . ' throws');
    Prodexa_AI_Test_Case::assert_same($expected_code, $thrown?->error_code, $label . ' code');
    Prodexa_AI_Test_Case::assert_false(isset($order->meta['_prodexa_selection_id']), $label . ' does not persist selection_id');
    Prodexa_AI_Test_Case::assert_false(isset($order->meta['_prodexa_selection_expires_at']), $label . ' does not persist expires_at');
    Prodexa_AI_Test_Case::assert_false(isset($order->meta['_prodexa_price']), $label . ' strips injected price');
}

prodexa_ai_assert_failed_attach(
    new Prodexa_AI_WooCommerce(
        prodexa_ai_error_client($settings, 410, 'SELECTION_EXPIRED', 'The selection has expired.'),
        new Prodexa_AI_Test_Session()
    ),
    $valid_selection,
    'SELECTION_EXPIRED',
    'expired selection'
);

prodexa_ai_assert_failed_attach(
    new Prodexa_AI_WooCommerce(
        prodexa_ai_error_client($settings, 400, 'VALIDATION_ERROR', 'offer_id is invalid.'),
        new Prodexa_AI_Test_Session()
    ),
    $valid_selection,
    'VALIDATION_ERROR',
    'invalid selection'
);

prodexa_ai_assert_failed_attach(
    new Prodexa_AI_WooCommerce(
        prodexa_ai_error_client($settings, 404, 'OFFER_NOT_FOUND', 'The offer was not found.'),
        new Prodexa_AI_Test_Session()
    ),
    $valid_selection,
    'OFFER_NOT_FOUND',
    'tenant-mismatch selection'
);

$malformed_session = new Prodexa_AI_Test_Session();
$malformed_session->set(Prodexa_AI_WooCommerce::SESSION_KEY, ['selection_id' => 'nope']);
$malformed = new Prodexa_AI_WooCommerce($no_call_client, $malformed_session);
$malformed_order = new Prodexa_AI_Test_Order();
$malformed_thrown = null;
try {
    $malformed->attach_selection_to_order($malformed_order, []);
} catch (Prodexa_AI_Checkout_Exception $exception) {
    $malformed_thrown = $exception;
}
$t::assert_true($malformed_thrown instanceof Prodexa_AI_Checkout_Exception, 'malformed pending selection throws');
$t::assert_same('VALIDATION_ERROR', $malformed_thrown?->error_code, 'malformed pending is VALIDATION_ERROR');
$t::assert_same([], $malformed_order->meta, 'malformed pending does not persist meta');

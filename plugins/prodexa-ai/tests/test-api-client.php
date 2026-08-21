<?php
/**
 * HTTP client health, timeout, HMAC headers, and license boundary tests.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

Prodexa_AI_Test_State::reset();
Prodexa_AI_Activator::activate();
$settings = new Prodexa_AI_Settings();
update_option(Prodexa_AI_Settings::OPTION_SETTINGS, [
    'backend_url' => 'http://localhost:8000',
    'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    'timeout' => 5,
]);
update_option(Prodexa_AI_Settings::OPTION_SECRETS, [
    'site_secret' => Prodexa_AI_Secrets::seal('site-secret'),
    'license_key' => '',
]);

$empty = new Prodexa_AI_Settings();
update_option(Prodexa_AI_Settings::OPTION_SETTINGS, [
    'backend_url' => '',
    'site_id' => '',
    'timeout' => 5,
]);
$client = new Prodexa_AI_Api_Client($empty);
$missing = $client->health();
$t::assert_false($missing->ok, 'health without URL fails');
$t::assert_same('NOT_CONFIGURED', $missing->error_code, 'health without URL is NOT_CONFIGURED');

update_option(Prodexa_AI_Settings::OPTION_SETTINGS, [
    'backend_url' => 'http://localhost:8000',
    'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    'timeout' => 5,
]);
$settings = new Prodexa_AI_Settings();

$health_client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args): array {
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/health', $url, 'health hits /v1/health');
    Prodexa_AI_Test_Case::assert_same('GET', $args['method'], 'health is GET');
    Prodexa_AI_Test_Case::assert_false(isset($args['headers']['x-prodexa-signature']), 'health is unsigned');

    return [
        'response' => ['code' => 200],
        'body' => '{"status":"ok","service":"prodexa-api","api_version":"v1"}',
        'headers' => ['x-request-id' => 'req_health'],
    ];
});
$ok = $health_client->health();
$t::assert_true($ok->ok, 'health success');
$t::assert_same('req_health', $ok->request_id, 'health echoes request id');
$t::assert_same('ok', $ok->data['status'] ?? null, 'health payload status');

$timeout_client = new Prodexa_AI_Api_Client($settings, static function (): array {
    return ['error' => 'http_request_timeout'];
});
$timed_out = $timeout_client->health();
$t::assert_same('TIMEOUT', $timed_out->error_code, 'timeout maps to TIMEOUT');
$t::assert_false(str_contains(strtolower($timed_out->message), 'secret'), 'timeout message has no secret');

$signed_headers = [];
$validate_client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args) use (&$signed_headers): array {
    $signed_headers = $args['headers'];
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/license/validate', $url, 'validate path');
    $expected = Prodexa_AI_Hmac::sign('site-secret', [
        'method' => 'POST',
        'path' => '/v1/license/validate',
        'timestamp' => $args['headers']['x-prodexa-timestamp'],
        'nonce' => $args['headers']['x-prodexa-nonce'],
        'body' => $args['body'],
        'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    ]);
    Prodexa_AI_Test_Case::assert_same($expected, $args['headers']['x-prodexa-signature'], 'validate HMAC matches body');

    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_lic'],
        'body' => json_encode([
            'valid' => true,
            'status' => 'active',
            'expires_at' => '2027-01-01T00:00:00.000Z',
            'plan' => ['code' => 'pilot', 'name' => 'Pilot'],
        ], JSON_THROW_ON_ERROR),
    ];
});
$license = new Prodexa_AI_License($settings, $validate_client);
$t::assert_false($license->cached_state_authorizes_access(), 'cached license never authorizes');
$refreshed = $license->refresh_from_api();
$t::assert_true($refreshed->ok, 'license validate succeeds');
$t::assert_true(isset($signed_headers['x-prodexa-signature']), 'signed request includes HMAC header');
$snapshot = $license->snapshot();
$t::assert_true($snapshot['valid'] === true, 'snapshot stores valid flag for display');
$t::assert_false($license->cached_state_authorizes_access(), 'snapshot still does not authorize');

$error_client = new Prodexa_AI_Api_Client($settings, static function (): array {
    return [
        'response' => ['code' => 403],
        'headers' => ['x-request-id' => 'req_denied'],
        'body' => json_encode([
            'error' => [
                'code' => 'LICENSE_EXPIRED',
                'message' => 'The Prodexa license is not active.',
                'request_id' => 'req_denied',
            ],
        ], JSON_THROW_ON_ERROR),
    ];
});
$denied = (new Prodexa_AI_License($settings, $error_client))->refresh_from_api();
$t::assert_same('LICENSE_EXPIRED', $denied->error_code, 'API error code is preserved');
$t::assert_same('req_denied', $denied->request_id, 'API request id is preserved');

$leaky = new Prodexa_AI_Api_Client($settings, static function (): array {
    return [
        'response' => ['code' => 500],
        'body' => json_encode([
            'error' => [
                'code' => 'FAIL',
                'message' => 'password=super-secret-value token=abc',
                'request_id' => 'req_leak',
            ],
        ], JSON_THROW_ON_ERROR),
    ];
});
$scrubbed = $leaky->health();
$t::assert_false(str_contains($scrubbed->message, 'super-secret-value'), 'API error messages cannot leak secrets');

$search_headers = [];
$search_client = new Prodexa_AI_Api_Client($settings, static function (string $url, array $args) use (&$search_headers): array {
    $search_headers = $args['headers'];
    Prodexa_AI_Test_Case::assert_same('http://localhost:8000/v1/discovery/search', $url, 'search hits /v1/discovery/search');
    Prodexa_AI_Test_Case::assert_same('POST', $args['method'], 'search is POST');
    $body = json_decode((string) $args['body'], true);
    Prodexa_AI_Test_Case::assert_true(is_array($body), 'search body is JSON');
    Prodexa_AI_Test_Case::assert_same('gift card', $body['query'] ?? null, 'search forwards query');
    Prodexa_AI_Test_Case::assert_false(isset($body['tenant_id']), 'search must not send tenant_id');
    $expected = Prodexa_AI_Hmac::sign('site-secret', [
        'method' => 'POST',
        'path' => '/v1/discovery/search',
        'timestamp' => $args['headers']['x-prodexa-timestamp'],
        'nonce' => $args['headers']['x-prodexa-nonce'],
        'body' => $args['body'],
        'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
    ]);
    Prodexa_AI_Test_Case::assert_same($expected, $args['headers']['x-prodexa-signature'], 'search HMAC matches body');

    return [
        'response' => ['code' => 200],
        'headers' => ['x-request-id' => 'req_search'],
        'body' => json_encode([
            'request_id' => 'req_search',
            'results' => [],
            'meta' => ['cached' => false, 'count' => 0],
        ], JSON_THROW_ON_ERROR),
    ];
});
$searched = $search_client->search([
    'query' => 'gift card',
    'page' => 1,
    'limit' => 10,
]);
$t::assert_true($searched->ok, 'discovery search succeeds');
$t::assert_true(isset($search_headers['x-prodexa-signature']), 'search request is HMAC signed');

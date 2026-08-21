<?php
/**
 * Discovery request validation and customer-safe field projection.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

$ok = Prodexa_AI_Discovery::parse_request("  bata gift card  ", '2', '10');
$t::assert_true($ok['ok'] === true, 'valid query parses');
$t::assert_same('bata gift card', $ok['query'] ?? null, 'query is trimmed and collapsed');
$t::assert_same(2, $ok['page'] ?? null, 'page is parsed');
$t::assert_same(10, $ok['limit'] ?? null, 'limit is parsed');

$empty = Prodexa_AI_Discovery::parse_request('   ', 1, 10);
$t::assert_true($empty['ok'] === false, 'blank query is invalid');
$t::assert_same('VALIDATION_ERROR', $empty['code'] ?? null, 'blank query is VALIDATION_ERROR');

$too_long = Prodexa_AI_Discovery::parse_request(str_repeat('a', 201), 1, 10);
$t::assert_true($too_long['ok'] === false, 'query over 200 characters is invalid');

$too_many = Prodexa_AI_Discovery::parse_request(implode(' ', range(1, 13)), 1, 10);
$t::assert_true($too_many['ok'] === false, 'more than 12 terms is invalid');

$bad_page = Prodexa_AI_Discovery::parse_request('gift', 0, 10);
$t::assert_true($bad_page['ok'] === false, 'page 0 is invalid');

$bad_limit = Prodexa_AI_Discovery::parse_request('gift', 1, 21);
$t::assert_true($bad_limit['ok'] === false, 'limit over 20 is invalid');

$t::assert_same(10, Prodexa_AI_Discovery::sanitize_limit('nope'), 'invalid shortcode limit falls back');
$t::assert_same(20, Prodexa_AI_Discovery::sanitize_limit(20), 'max shortcode limit kept');

$body = Prodexa_AI_Discovery::build_body([
    'query' => 'gift card',
    'page' => 1,
    'limit' => 10,
], 'bdt');
$t::assert_same('BDT', $body['context']['currency'] ?? null, 'store currency is normalized into context');
$t::assert_false(isset($body['tenant_id']), 'request body has no tenant_id');

$no_context = Prodexa_AI_Discovery::build_body([
    'query' => 'gift card',
    'page' => 1,
    'limit' => 10,
], 'not-iso');
$t::assert_false(isset($no_context['context']), 'invalid currency is omitted');

$projected = Prodexa_AI_Discovery::project_response([
    'request_id' => 'req_1',
    'results' => [
        [
            'offer_id' => 'off_1',
            'title' => '<script>alert(1)</script>Gift card',
            'image_url' => 'javascript:alert(1)',
            'display_price' => 1000,
            'currency' => 'BDT',
            'availability' => 'in_stock',
            'freshness' => ['retrieved_at' => '2026-08-21T00:00:00Z'],
            'source_url' => 'https://secret.example/product',
            'source_id' => 'src_private',
            'tenant_id' => 'ten_private',
        ],
        [
            'offer_id' => 'off_2',
            'title' => 'Valid',
            'image_url' => 'https://cdn.example.com/p.jpg?w=80',
            'display_price' => 50.5,
            'currency' => 'USD',
            'availability' => 'hacked',
            'freshness' => ['retrieved_at' => '2026-08-21T00:00:00Z'],
        ],
    ],
    'meta' => ['cached' => false, 'count' => 2],
]);
$t::assert_same(1, $projected['meta']['count'], 'malformed offers are dropped');
$t::assert_same('Gift card', $projected['results'][0]['title'] ?? null, 'script tags are stripped from titles');
$t::assert_true(array_key_exists('image_url', $projected['results'][0]), 'image_url key is present');
$t::assert_true($projected['results'][0]['image_url'] === null, 'javascript image URLs are dropped');
$t::assert_false(isset($projected['results'][0]['source_url']), 'source_url is not projected');
$t::assert_false(isset($projected['results'][0]['source_id']), 'source_id is not projected');
$t::assert_false(isset($projected['results'][0]['tenant_id']), 'tenant_id is not projected');
$encoded = json_encode($projected);
$t::assert_false(is_string($encoded) && str_contains($encoded, 'secret.example'), 'private source URLs do not leak through JSON');
$t::assert_false(is_string($encoded) && str_contains($encoded, '<script'), 'projected JSON has no script tags');

$empty_page = Prodexa_AI_Discovery::project_response([
    'request_id' => 'req_empty',
    'results' => [],
    'meta' => ['cached' => false, 'count' => 0],
]);
$t::assert_same(0, $empty_page['meta']['count'], 'empty page count is zero');

$t::assert_same(
    'Product search is not configured yet.',
    Prodexa_AI_Discovery::user_message('MISSING_CREDENTIALS'),
    'missing credentials message is customer-safe'
);
$t::assert_same(
    'Search query is too long.',
    Prodexa_AI_Discovery::user_message('VALIDATION_ERROR', 'Search query is too long.'),
    'known validation messages are preserved'
);
$t::assert_false(
    str_contains(Prodexa_AI_Discovery::user_message('API_ERROR', 'password=super-secret'), 'super-secret'),
    'unknown API messages are not forwarded'
);

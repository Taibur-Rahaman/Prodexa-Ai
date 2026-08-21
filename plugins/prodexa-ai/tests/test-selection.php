<?php
/**
 * Discovery select request validation and customer-safe projection.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

$ok = Prodexa_AI_Selection::parse_offer_id('off_00000000-0000-4000-8000-000000000001');
$t::assert_true($ok['ok'] === true, 'valid offer_id parses');
$t::assert_same('off_00000000-0000-4000-8000-000000000001', $ok['offer_id'] ?? null, 'offer_id is preserved');

$blank = Prodexa_AI_Selection::parse_offer_id('   ');
$t::assert_true($blank['ok'] === false, 'blank offer_id is invalid');
$t::assert_same('VALIDATION_ERROR', $blank['code'] ?? null, 'blank offer_id is VALIDATION_ERROR');

$bad_prefix = Prodexa_AI_Selection::parse_offer_id('offer-1');
$t::assert_true($bad_prefix['ok'] === false, 'offer_id without off_ prefix is invalid');

$id = Prodexa_AI_Selection::new_selection_id();
$t::assert_true(is_string($id) && preg_match(Prodexa_AI_Selection::SELECTION_ID_PATTERN, $id) === 1, 'minted selection_id matches API pattern');
$t::assert_true(str_starts_with($id, 'sel_'), 'minted selection_id uses sel_ prefix');

$projected = Prodexa_AI_Selection::project_response([
    'selection_id' => 'sel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'offer_id' => 'off_00000000-0000-4000-8000-000000000001',
    'expires_at' => '2026-08-21T00:15:00.000Z',
    'tenant_id' => 'ten_private',
    'site_id' => 'sit_private',
    'source_url' => 'https://secret.example/hidden',
    'display_price' => 999,
]);
$t::assert_same(
    ['selection_id', 'offer_id', 'expires_at'],
    $projected !== null ? array_keys($projected) : [],
    'select projection keeps only contract keys'
);
$t::assert_false(isset($projected['tenant_id']), 'tenant_id is not projected');
$t::assert_false(isset($projected['display_price']), 'price is not projected');
$encoded = json_encode($projected);
$t::assert_false(is_string($encoded) && str_contains($encoded, 'secret.example'), 'private source URLs do not leak');

$t::assert_true(Prodexa_AI_Selection::project_response([
    'selection_id' => 'sel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'offer_id' => 'off_00000000-0000-4000-8000-000000000001',
    'expires_at' => 'not-a-timestamp',
]) === null, 'invalid expires_at is rejected');

$meta = Prodexa_AI_Selection::order_meta([
    'selection_id' => 'sel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'offer_id' => 'off_00000000-0000-4000-8000-000000000001',
    'expires_at' => '2026-08-21T00:15:00.000Z',
]);
$t::assert_same(
    ['_prodexa_selection_id', '_prodexa_selection_expires_at'],
    array_keys($meta),
    'order meta is only the selection reference'
);
$t::assert_false(in_array('_prodexa_offer_id', array_keys($meta), true), 'offer_id is not order meta');

$t::assert_same(
    'That selection has expired. Search again and choose the offer.',
    Prodexa_AI_Selection::user_message('SELECTION_EXPIRED'),
    'expired selection message is customer-safe'
);
$t::assert_false(
    str_contains(Prodexa_AI_Selection::user_message('API_ERROR', 'password=super-secret'), 'super-secret'),
    'unknown API messages are not forwarded'
);

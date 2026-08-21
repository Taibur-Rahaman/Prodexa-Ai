<?php
/**
 * HMAC vector locked to apps/api DEC-018 signer.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

$input = [
    'method' => 'POST',
    'path' => '/v1/license/validate',
    'timestamp' => '1787310000',
    'nonce' => 'nonce-1',
    'body' => '{"domain":"shop.example.com"}',
    'site_id' => 'sit_11111111-1111-1111-1111-111111111111',
];

$signature = Prodexa_AI_Hmac::sign('site-secret', $input);
$t::assert_same(
    'b8f94e065926dd54b18e1cde9d26134f3eb901a150110dd3f54462d4c102e680',
    $signature,
    'HMAC matches the API site-hmac test vector'
);

$mutated = Prodexa_AI_Hmac::sign('site-secret', [...$input, 'body' => '{"domain":"evil.example.com"}']);
$t::assert_true($signature !== $mutated, 'mutated body changes signature');

$canonical = Prodexa_AI_Hmac::canonical_string($input);
$t::assert_true(str_starts_with($canonical, "v1\nPOST\n/v1/license/validate\n"), 'canonical string uses DEC-018 layout');

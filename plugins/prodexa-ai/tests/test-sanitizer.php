<?php
/**
 * URL, site ID, timeout, and domain sanitizer tests.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

$t::assert_same(
    'http://localhost:8000',
    Prodexa_AI_Sanitizer::sanitize_backend_url('http://localhost:8000/'),
    'localhost API URL is kept'
);

$t::assert_same(
    'https://example.com/v1',
    Prodexa_AI_Sanitizer::sanitize_backend_url('https://example.com/v1/'),
    'https URL keeps path without trailing slash'
);

$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_backend_url('javascript:alert(1)'), 'javascript URLs are rejected');
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_backend_url('https://user:pass@example.com'), 'userinfo is rejected');
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_backend_url(''), 'empty URL stays empty');
$t::assert_true(Prodexa_AI_Sanitizer::is_loopback_url('http://localhost:8000'), 'localhost is loopback');

$t::assert_same(
    'sit_11111111-1111-1111-1111-111111111111',
    Prodexa_AI_Sanitizer::sanitize_site_id('SIT_11111111-1111-1111-1111-111111111111'),
    'valid site id is normalized'
);
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_site_id('not-a-site'), 'invalid site id is dropped');
$t::assert_same(10, Prodexa_AI_Sanitizer::sanitize_timeout(10), 'timeout 10 kept');
$t::assert_same(30, Prodexa_AI_Sanitizer::sanitize_timeout(99), 'timeout capped at 30');
$t::assert_same(1, Prodexa_AI_Sanitizer::sanitize_timeout(0), 'timeout min 1');

$t::assert_same(
    'shop.example.com',
    Prodexa_AI_Sanitizer::normalize_domain('https://WWW.Shop.Example.COM:443/path'),
    'domain normalization matches API'
);
$t::assert_same('shop.example.com', Prodexa_AI_Sanitizer::normalize_domain('shop.example.com.'), 'trailing dot stripped');
$t::assert_same('localhost', Prodexa_AI_Sanitizer::normalize_domain('localhost'), 'localhost domain allowed');
$t::assert_same(null, Prodexa_AI_Sanitizer::normalize_domain(''), 'empty domain rejected');
$t::assert_same(null, Prodexa_AI_Sanitizer::normalize_domain('not a domain'), 'malformed domain rejected');
$t::assert_same(null, Prodexa_AI_Sanitizer::normalize_domain('[::1]'), 'ipv6 rejected');

$t::assert_same(
    'http://localhost:8000/v1/health',
    Prodexa_AI_Sanitizer::join_url('http://localhost:8000', '/v1/health'),
    'health path join'
);

$t::assert_same(
    'https://cdn.example.com/p.jpg?w=200',
    Prodexa_AI_Sanitizer::sanitize_public_http_url('https://cdn.example.com/p.jpg?w=200#frag'),
    'image URLs keep query and drop fragment'
);
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_public_http_url('javascript:alert(1)'), 'javascript image URLs rejected');
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_public_http_url('https://user:pass@cdn.example.com/p.jpg'), 'image userinfo rejected');
$t::assert_same('', Prodexa_AI_Sanitizer::sanitize_public_http_url('data:image/gif;base64,AAAA'), 'data URLs rejected');

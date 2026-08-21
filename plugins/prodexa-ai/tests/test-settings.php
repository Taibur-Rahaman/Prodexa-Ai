<?php
/**
 * Settings sanitization, secret storage, and activation tests.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;

Prodexa_AI_Test_State::reset();
Prodexa_AI_Activator::activate();

$t::assert_true(isset(Prodexa_AI_Test_State::$options[Prodexa_AI_Settings::OPTION_SETTINGS]), 'activation creates settings');
$t::assert_true(isset(Prodexa_AI_Test_State::$options[Prodexa_AI_Settings::OPTION_SECRETS]), 'activation creates secrets option');

$settings = new Prodexa_AI_Settings();
$public = $settings->sanitize_settings([
    'backend_url' => 'http://localhost:8000/',
    'site_id' => 'sit_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'timeout' => '12',
]);
$t::assert_same('http://localhost:8000', $public['backend_url'], 'settings sanitize backend URL');
$t::assert_same('sit_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', $public['site_id'], 'settings sanitize site id');
$t::assert_same(12, $public['timeout'], 'settings sanitize timeout');

$rejected = $settings->sanitize_settings([
    'backend_url' => 'javascript:alert(1)',
    'site_id' => 'nope',
    'timeout' => 10,
]);
$t::assert_same('', $rejected['backend_url'], 'invalid backend URL stored as empty');
$t::assert_same('', $rejected['site_id'], 'invalid site id stored as empty');

$sealed = $settings->sanitize_secrets([
    'site_secret' => "super\nsecret-value",
    'license_key' => 'lic-test-key',
]);
$t::assert_true($sealed['site_secret'] === '', 'secrets with newlines are rejected');

$sealed = $settings->sanitize_secrets([
    'site_secret' => 'super-secret-value',
    'license_key' => 'lic-test-key',
]);
update_option(Prodexa_AI_Settings::OPTION_SECRETS, $sealed);
$t::assert_true(str_starts_with($sealed['site_secret'], 'v1:'), 'site secret is sealed at rest');
$t::assert_false(str_contains($sealed['site_secret'], 'super-secret-value'), 'plaintext secret is not stored');
$t::assert_same('super-secret-value', $settings->site_secret(), 'sealed site secret round-trips');
$t::assert_same('lic-test-key', $settings->license_key(), 'sealed license key round-trips');

$kept = $settings->sanitize_secrets([
    'site_secret' => '',
    'license_key' => '',
]);
$t::assert_same($sealed['site_secret'], $kept['site_secret'], 'blank secret field keeps stored secret');

$cleared = $settings->sanitize_secrets([
    'site_secret' => '',
    'clear_site_secret' => '1',
    'license_key' => '',
]);
$t::assert_same('', $cleared['site_secret'], 'clear checkbox removes site secret');

Prodexa_AI_Deactivator::deactivate();
$t::assert_true(isset(Prodexa_AI_Test_State::$options[Prodexa_AI_Settings::OPTION_SECRETS]), 'deactivation keeps secrets');

$settings->register();
$t::assert_false(
    !empty(Prodexa_AI_Test_State::$registered_settings[Prodexa_AI_Settings::OPTION_SECRETS]['args']['show_in_rest']),
    'secrets are not exposed in REST'
);
$t::assert_false(
    !empty(Prodexa_AI_Test_State::$registered_settings[Prodexa_AI_Settings::OPTION_SETTINGS]['args']['show_in_rest']),
    'settings are not exposed in REST'
);

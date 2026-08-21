<?php
/**
 * Admin capability/nonce checks and secret non-exposure.
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
$client = new Prodexa_AI_Api_Client($settings, static function (): array {
    return [
        'response' => ['code' => 200],
        'body' => '{"status":"ok","service":"prodexa-api","api_version":"v1"}',
        'headers' => ['x-request-id' => 'req_ok'],
    ];
});
$license = new Prodexa_AI_License($settings, $client);
$admin = new Prodexa_AI_Admin($settings, $client, $license);

Prodexa_AI_Test_State::$can_manage = false;
$_POST['prodexa_ai_action'] = 'health';
$_POST['_wpnonce'] = 'nonce-' . Prodexa_AI_Admin::HEALTH_ACTION;
$_REQUEST = $_POST;
$denied = false;
try {
    $admin->handle_actions();
} catch (RuntimeException $e) {
    $denied = str_contains($e->getMessage(), 'wp_die:403');
}
$t::assert_true($denied, 'health action requires manage_options');

Prodexa_AI_Test_State::$can_manage = true;
$_POST['_wpnonce'] = 'bad-nonce';
$_REQUEST = $_POST;
$bad_nonce = false;
try {
    $admin->handle_actions();
} catch (RuntimeException $e) {
    $bad_nonce = str_contains($e->getMessage(), 'wp_die:403');
}
$t::assert_true($bad_nonce, 'health action requires a valid nonce');

$_POST['prodexa_ai_action'] = 'health';
$_POST['_wpnonce'] = 'nonce-' . Prodexa_AI_Admin::HEALTH_ACTION;
$_REQUEST = $_POST;
$admin->handle_actions();
$t::assert_true(
    count(array_filter(
        Prodexa_AI_Test_State::$settings_errors,
        static fn(array $row): bool => $row['code'] === 'prodexa_ai_health_ok'
    )) === 1,
    'valid nonce+capability runs health check'
);

ob_start();
$admin->render_page();
$html = (string) ob_get_clean();
$t::assert_true(str_contains($html, 'name="prodexa_ai_settings[backend_url]"'), 'settings form renders');
$t::assert_false(str_contains($html, 'must-never-render'), 'site secret is not printed');
$t::assert_false(str_contains($html, 'license-must-never-render'), 'license key is not printed');
$t::assert_true(str_contains($html, 'type="password"'), 'secret fields are password inputs');
$t::assert_false(preg_match('/x-prodexa-signature|hmac/i', $html) === 1, 'admin HTML does not embed HMAC material');

$plugin_root = dirname(__DIR__);
$javascript = glob($plugin_root . '/assets/js/*.js') ?: [];
foreach ($javascript as $file) {
    $contents = (string) file_get_contents($file);
    $t::assert_false(
        str_contains($contents, 'must-never-render') || preg_match('/site_secret|license_key|x-prodexa-signature/i', $contents) === 1,
        basename($file) . ' must not contain secrets'
    );
}
$t::assert_true(true, 'no admin JavaScript ships with the skeleton (or it is free of secrets)');

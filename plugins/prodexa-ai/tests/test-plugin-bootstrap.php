<?php
/**
 * Plugin bootstrap, uninstall, and source-scan tests.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

$t = Prodexa_AI_Test_Case::class;
$root = dirname(__DIR__);
$bootstrap = (string) file_get_contents($root . '/prodexa-ai.php');

$t::assert_true(str_contains($bootstrap, 'Plugin Name:       Prodexa AI'), 'plugin header is present');
$t::assert_true(str_contains($bootstrap, "defined('ABSPATH')"), 'direct access is blocked');
$t::assert_true(str_contains($bootstrap, 'register_activation_hook'), 'activation hook is registered');
$t::assert_true(str_contains($bootstrap, 'register_deactivation_hook'), 'deactivation hook is registered');

$t::assert_false(
    (bool) preg_match('/api\.prodexaai\.cloud/', $bootstrap),
    'bootstrap does not hard-code api.prodexaai.cloud'
);

$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
$php_files = [];
foreach ($iterator as $file) {
    if (!$file->isFile()) {
        continue;
    }
    $path = $file->getPathname();
    if (!str_ends_with($path, '.php')) {
        continue;
    }
    if (str_contains($path, '/tests/')) {
        continue;
    }
    $php_files[] = $path;
    $contents = (string) file_get_contents($path);
    $t::assert_false(
        str_contains($contents, 'sk-') && str_contains($contents, 'BEGIN PRIVATE KEY'),
        basename($path) . ' must not contain obvious secrets'
    );
    $t::assert_false(
        (bool) preg_match("/define\(\s*'PRODEXA_SITE_SECRET'/", $contents),
        basename($path) . ' must not embed a global site secret constant'
    );
}

$t::assert_true(count($php_files) >= 8, 'plugin PHP files are present');

Prodexa_AI_Test_State::reset();
Prodexa_AI_Activator::activate();
update_option(Prodexa_AI_Settings::OPTION_SECRETS, ['site_secret' => 'sealed', 'license_key' => 'sealed']);
$uninstall = $root . '/uninstall.php';
$t::assert_true(is_file($uninstall), 'uninstall.php exists');

if (!defined('WP_UNINSTALL_PLUGIN')) {
    define('WP_UNINSTALL_PLUGIN', true);
}
require $uninstall;
$t::assert_false(isset(Prodexa_AI_Test_State::$options['prodexa_ai_settings']), 'uninstall deletes settings');
$t::assert_false(isset(Prodexa_AI_Test_State::$options['prodexa_ai_secrets']), 'uninstall deletes secrets');
$t::assert_false(isset(Prodexa_AI_Test_State::$options['prodexa_ai_license_snapshot']), 'uninstall deletes snapshot');

Prodexa_AI_Test_State::$is_admin = false;
do_action('plugins_loaded');
$t::assert_true(function_exists('prodexa_ai'), 'plugin function is available after load');
$t::assert_true(prodexa_ai() instanceof Prodexa_AI_Plugin, 'plugin instance boots');
$t::assert_true(isset(Prodexa_AI_Test_State::$shortcodes['prodexa_search']), 'storefront shortcode registers on the frontend');

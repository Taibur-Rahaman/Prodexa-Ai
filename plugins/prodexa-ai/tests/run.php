<?php
/**
 * Run plugin unit tests without a WordPress install.
 *
 * Usage: php plugins/prodexa-ai/tests/run.php
 */

declare(strict_types=1);

require_once __DIR__ . '/wp-stubs.php';
require_once __DIR__ . '/helpers.php';

$plugin_root = dirname(__DIR__);
require_once $plugin_root . '/prodexa-ai.php';

$files = [
    __DIR__ . '/test-hmac.php',
    __DIR__ . '/test-sanitizer.php',
    __DIR__ . '/test-settings.php',
    __DIR__ . '/test-api-client.php',
    __DIR__ . '/test-discovery.php',
    __DIR__ . '/test-selection.php',
    __DIR__ . '/test-storefront.php',
    __DIR__ . '/test-woocommerce.php',
    __DIR__ . '/test-security.php',
    __DIR__ . '/test-plugin-bootstrap.php',
];

foreach ($files as $file) {
    require $file;
}

$passed = Prodexa_AI_Test_Case::$passed;
$failed = Prodexa_AI_Test_Case::$failed;
echo "Prodexa AI plugin tests: {$passed} passed, {$failed} failed\n";

if ($failed > 0) {
    exit(1);
}

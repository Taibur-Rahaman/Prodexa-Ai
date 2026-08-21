<?php
/**
 * Plugin Name:       Prodexa AI
 * Plugin URI:        https://github.com/Taibur-Rahaman/Prodexa-Ai
 * Description:       Connects a WordPress/WooCommerce store to the hosted Prodexa discovery API. The plugin is a client; licensing and discovery remain server-side.
 * Version:           0.1.2
 * Requires at least: 6.4
 * Requires PHP:      8.2
 * Author:            Prodexa
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       prodexa-ai
 * Domain Path:       /languages
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('PRODEXA_AI_VERSION', '0.1.2');
define('PRODEXA_AI_PLUGIN_FILE', __FILE__);
define('PRODEXA_AI_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-hmac.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-sanitizer.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-http-result.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-secrets.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-settings.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-api-client.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-license.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-activator.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-deactivator.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-admin.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-discovery.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-selection.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-woocommerce.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-storefront.php';
require_once PRODEXA_AI_PLUGIN_DIR . 'includes/class-plugin.php';

register_activation_hook(PRODEXA_AI_PLUGIN_FILE, [Prodexa_AI_Activator::class, 'activate']);
register_deactivation_hook(PRODEXA_AI_PLUGIN_FILE, [Prodexa_AI_Deactivator::class, 'deactivate']);

/**
 * @return Prodexa_AI_Plugin
 */
function prodexa_ai(): Prodexa_AI_Plugin
{
    return Prodexa_AI_Plugin::instance();
}

add_action('plugins_loaded', static function (): void {
    prodexa_ai()->boot();
});

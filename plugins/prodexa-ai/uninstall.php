<?php
/**
 * Fired when the plugin is uninstalled. Deletes options including sealed secrets.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('prodexa_ai_settings');
delete_option('prodexa_ai_secrets');
delete_option('prodexa_ai_license_snapshot');

<?php
/**
 * Safe plugin activation.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Activator
{
    public static function activate(): void
    {
        if (version_compare(PHP_VERSION, '8.2.0', '<')) {
            deactivate_plugins(plugin_basename(PRODEXA_AI_PLUGIN_FILE));
            wp_die(
                esc_html__('Prodexa AI requires PHP 8.2 or later.', 'prodexa-ai'),
                esc_html__('Plugin Activation Error', 'prodexa-ai'),
                ['back_link' => true]
            );
        }

        add_option(Prodexa_AI_Settings::OPTION_SETTINGS, Prodexa_AI_Settings::defaults(), '', false);
        add_option(
            Prodexa_AI_Settings::OPTION_SECRETS,
            [
                'site_secret' => '',
                'license_key' => '',
            ],
            '',
            false
        );
        add_option(Prodexa_AI_Settings::OPTION_SNAPSHOT, [], '', false);
    }
}

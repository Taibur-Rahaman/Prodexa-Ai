<?php
/**
 * Plugin bootstrap. WordPress is a client; the hosted API owns business logic.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Plugin
{
    private static ?self $instance = null;

    private ?Prodexa_AI_Settings $settings = null;

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function boot(): void
    {
        load_plugin_textdomain('prodexa-ai', false, dirname(plugin_basename(PRODEXA_AI_PLUGIN_FILE)) . '/languages');

        $this->settings = new Prodexa_AI_Settings();
        $client = new Prodexa_AI_Api_Client($this->settings);
        $license = new Prodexa_AI_License($this->settings, $client);
        $storefront = new Prodexa_AI_Storefront($this->settings, $client);
        $storefront->register();

        if (is_admin()) {
            $admin = new Prodexa_AI_Admin($this->settings, $client, $license);
            $admin->register();
        }
    }

    public function settings(): Prodexa_AI_Settings
    {
        if ($this->settings === null) {
            $this->settings = new Prodexa_AI_Settings();
        }

        return $this->settings;
    }
}

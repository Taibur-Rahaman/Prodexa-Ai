<?php
/**
 * Merchant admin settings UI. No secrets are printed or sent to JavaScript.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Admin
{
    public const MENU_SLUG = 'prodexa-ai';

    public const HEALTH_ACTION = 'prodexa_ai_health_check';

    public const LICENSE_ACTION = 'prodexa_ai_license_refresh';

    public function __construct(
        private readonly Prodexa_AI_Settings $settings,
        private readonly Prodexa_AI_Api_Client $client,
        private readonly Prodexa_AI_License $license,
    ) {
    }

    public function register(): void
    {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_init', [$this, 'handle_actions']);
        add_action('admin_init', [$this->settings, 'register']);
    }

    public function add_menu(): void
    {
        add_options_page(
            __('Prodexa AI', 'prodexa-ai'),
            __('Prodexa AI', 'prodexa-ai'),
            Prodexa_AI_Settings::CAPABILITY,
            self::MENU_SLUG,
            [$this, 'render_page']
        );
    }

    public function handle_actions(): void
    {
        if (!is_admin()) {
            return;
        }

        $action = isset($_POST['prodexa_ai_action']) ? sanitize_key((string) wp_unslash($_POST['prodexa_ai_action'])) : '';
        if ($action === '') {
            return;
        }

        if (!current_user_can(Prodexa_AI_Settings::CAPABILITY)) {
            wp_die(
                esc_html__('You do not have permission to manage Prodexa AI.', 'prodexa-ai'),
                '',
                ['response' => 403]
            );
        }

        if ($action === 'health') {
            check_admin_referer(self::HEALTH_ACTION);
            $this->run_health_check();
            return;
        }

        if ($action === 'license') {
            check_admin_referer(self::LICENSE_ACTION);
            $this->run_license_refresh();
        }
    }

    public function render_page(): void
    {
        if (!current_user_can(Prodexa_AI_Settings::CAPABILITY)) {
            wp_die(
                esc_html__('You do not have permission to manage Prodexa AI.', 'prodexa-ai'),
                '',
                ['response' => 403]
            );
        }

        $public = $this->settings->get_public();
        $snapshot = $this->license->snapshot();
        $https_warning = $public['backend_url'] !== ''
            && !str_starts_with($public['backend_url'], 'https://')
            && !Prodexa_AI_Sanitizer::is_loopback_url($public['backend_url']);

        $view = [
            'backend_url' => $public['backend_url'],
            'site_id' => $public['site_id'],
            'timeout' => $public['timeout'],
            'has_site_secret' => $this->settings->has_site_secret(),
            'has_license_key' => $this->settings->has_license_key(),
            'https_warning' => $https_warning,
            'snapshot' => $snapshot,
            'health_action' => self::HEALTH_ACTION,
            'license_action' => self::LICENSE_ACTION,
            'option_group' => Prodexa_AI_Settings::GROUP,
        ];

        include PRODEXA_AI_PLUGIN_DIR . 'templates/admin-settings.php';
    }

    private function run_health_check(): void
    {
        $result = $this->client->health();
        if ($result->ok && $this->is_healthy($result)) {
            add_settings_error(
                'prodexa_ai',
                'prodexa_ai_health_ok',
                sprintf(
                    /* translators: 1: request id */
                    __('Connected to Prodexa API. Request ID: %s', 'prodexa-ai'),
                    $result->request_id ?? ''
                ),
                'success'
            );
            return;
        }

        add_settings_error(
            'prodexa_ai',
            'prodexa_ai_health_fail',
            sprintf(
                /* translators: 1: error code, 2: message */
                __('Health check failed (%1$s): %2$s', 'prodexa-ai'),
                $result->error_code ?? 'ERROR',
                $result->message
            ),
            'error'
        );
    }

    private function run_license_refresh(): void
    {
        $result = $this->license->refresh_from_api();
        if ($result->ok) {
            add_settings_error(
                'prodexa_ai',
                'prodexa_ai_license_ok',
                __('License status was refreshed from the Prodexa API. Cached plugin state is not used as authorization.', 'prodexa-ai'),
                'success'
            );
            return;
        }

        add_settings_error(
            'prodexa_ai',
            'prodexa_ai_license_fail',
            sprintf(
                /* translators: 1: error code, 2: message */
                __('License refresh failed (%1$s): %2$s', 'prodexa-ai'),
                $result->error_code ?? 'ERROR',
                $result->message
            ),
            'error'
        );
    }

    private function is_healthy(Prodexa_AI_Http_Result $result): bool
    {
        $data = $result->data ?? [];

        return ($data['status'] ?? null) === 'ok'
            && ($data['service'] ?? null) === 'prodexa-api';
    }
}

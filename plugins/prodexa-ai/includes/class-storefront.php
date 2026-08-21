<?php
/**
 * Storefront discovery search UI. HMAC secrets stay in PHP; browsers only see a CSRF nonce.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Storefront
{
    public const SHORTCODE = 'prodexa_search';

    public const AJAX_ACTION = 'prodexa_ai_search';

    public const NONCE_ACTION = 'prodexa_ai_storefront_search';

    public const SCRIPT_HANDLE = 'prodexa-ai-search';

    public const STYLE_HANDLE = 'prodexa-ai-search';

    private static int $instance = 0;

    public function __construct(
        private readonly Prodexa_AI_Settings $settings,
        private readonly Prodexa_AI_Api_Client $client,
    ) {
    }

    public function register(): void
    {
        add_shortcode(self::SHORTCODE, [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        add_action('wp_ajax_' . self::AJAX_ACTION, [$this, 'handle_search']);
        add_action('wp_ajax_nopriv_' . self::AJAX_ACTION, [$this, 'handle_search']);
    }

    public function register_assets(): void
    {
        $base = plugin_dir_url(PRODEXA_AI_PLUGIN_FILE);
        wp_register_style(
            self::STYLE_HANDLE,
            $base . 'assets/css/search.css',
            [],
            PRODEXA_AI_VERSION
        );
        wp_register_script(
            self::SCRIPT_HANDLE,
            $base . 'assets/js/search.js',
            [],
            PRODEXA_AI_VERSION,
            true
        );
    }

    /**
     * @param array<string, mixed>|string $atts
     */
    public function render_shortcode(array|string $atts = []): string
    {
        $this->register_assets();
        wp_enqueue_style(self::STYLE_HANDLE);
        wp_enqueue_script(self::SCRIPT_HANDLE);
        wp_localize_script(self::SCRIPT_HANDLE, 'prodexaAiSearch', $this->public_script_data());

        $atts = shortcode_atts(
            ['limit' => (string) Prodexa_AI_Discovery::DEFAULT_LIMIT],
            is_array($atts) ? $atts : [],
            self::SHORTCODE
        );
        $limit = Prodexa_AI_Discovery::sanitize_limit($atts['limit']);

        self::$instance++;
        $input_id = 'prodexa-ai-query-' . self::$instance;

        ob_start();
        $view = [
            'input_id' => $input_id,
            'limit' => $limit,
        ];
        include PRODEXA_AI_PLUGIN_DIR . 'templates/storefront-search.php';

        return (string) ob_get_clean();
    }

    /**
     * Public AJAX payload. Must never include site secrets, license keys, or HMAC headers.
     *
     * @return array{
     *   ajaxUrl: string,
     *   nonce: string,
     *   action: string,
     *   i18n: array<string, string>
     * }
     */
    public function public_script_data(): array
    {
        return [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce(self::NONCE_ACTION),
            'action' => self::AJAX_ACTION,
            'i18n' => [
                'loading' => __('Searching…', 'prodexa-ai'),
                'empty' => __('No products matched that search.', 'prodexa-ai'),
                'error' => __('Product search is temporarily unavailable. The rest of the store still works.', 'prodexa-ai'),
                'previous' => __('Previous', 'prodexa-ai'),
                'next' => __('Next', 'prodexa-ai'),
                'page' => __('Page %s', 'prodexa-ai'),
                'in_stock' => __('In stock', 'prodexa-ai'),
                'out_of_stock' => __('Out of stock', 'prodexa-ai'),
                'preorder' => __('Preorder', 'prodexa-ai'),
                'unknown' => __('Availability unknown', 'prodexa-ai'),
                'image_unavailable' => __('No image', 'prodexa-ai'),
            ],
        ];
    }

    public function handle_search(): void
    {
        check_ajax_referer(self::NONCE_ACTION, 'nonce');

        $query = isset($_POST['query']) ? sanitize_text_field((string) wp_unslash($_POST['query'])) : '';
        $page = $_POST['page'] ?? Prodexa_AI_Discovery::DEFAULT_PAGE;
        $limit = $_POST['limit'] ?? Prodexa_AI_Discovery::DEFAULT_LIMIT;

        $parsed = Prodexa_AI_Discovery::parse_request($query, $page, $limit);
        if ($parsed['ok'] !== true) {
            wp_send_json_error(
                [
                    'code' => $parsed['code'],
                    'message' => Prodexa_AI_Discovery::user_message($parsed['code'], $parsed['message']),
                    'request_id' => null,
                ],
                200
            );
        }

        $body = Prodexa_AI_Discovery::build_body($parsed, Prodexa_AI_Discovery::store_currency());
        $result = $this->client->search($body);

        if (!$result->ok) {
            wp_send_json_error(
                [
                    'code' => $result->error_code ?? 'API_ERROR',
                    'message' => Prodexa_AI_Discovery::user_message(
                        $result->error_code ?? 'API_ERROR',
                        $result->message
                    ),
                    'request_id' => $result->request_id,
                ],
                200
            );
        }

        $payload = Prodexa_AI_Discovery::project_response($result->data, $result->request_id);
        $payload['page'] = $parsed['page'];
        $payload['limit'] = $parsed['limit'];

        wp_send_json_success($payload, 200);
    }
}

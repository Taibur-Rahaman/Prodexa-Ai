<?php
/**
 * Minimal WordPress stubs for plugin unit tests. Not a WordPress runtime.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', sys_get_temp_dir() . '/prodexa-ai-wp-stubs/');
}

if (!defined('AUTH_KEY')) {
    define('AUTH_KEY', 'test-auth-key-prodexa');
}
if (!defined('SECURE_AUTH_KEY')) {
    define('SECURE_AUTH_KEY', 'test-secure-auth-key-prodexa');
}
if (!defined('AUTH_SALT')) {
    define('AUTH_SALT', 'test-auth-salt-prodexa');
}
if (!defined('SECURE_AUTH_SALT')) {
    define('SECURE_AUTH_SALT', 'test-secure-auth-salt-prodexa');
}

final class Prodexa_AI_Test_State
{
    /** @var array<string, mixed> */
    public static array $options = [];

    /** @var array<string, list<callable>> */
    public static array $actions = [];

    /** @var list<array{id: string, title: string, message: string, type: string}> */
    public static array $settings_errors = [];

    /** @var array<string, mixed> */
    public static array $registered_settings = [];

    public static bool $is_admin = true;

    public static bool $can_manage = true;

    public static string $home_url = 'https://shop.example.com';

    public static function reset(): void
    {
        self::$options = [];
        self::$settings_errors = [];
        self::$registered_settings = [];
        self::$is_admin = true;
        self::$can_manage = true;
        self::$home_url = 'https://shop.example.com';
        $_POST = [];
        $_REQUEST = [];
        $_GET = [];
    }
}

function add_action(string $hook, callable $callback, int $priority = 10, int $accepted_args = 1): void
{
    Prodexa_AI_Test_State::$actions[$hook][] = $callback;
}

function do_action(string $hook): void
{
    foreach (Prodexa_AI_Test_State::$actions[$hook] ?? [] as $callback) {
        $callback();
    }
}

function add_option(string $name, mixed $value, string $deprecated = '', bool|string $autoload = true): bool
{
    if (array_key_exists($name, Prodexa_AI_Test_State::$options)) {
        return false;
    }
    Prodexa_AI_Test_State::$options[$name] = $value;

    return true;
}

function get_option(string $name, mixed $default = false): mixed
{
    return array_key_exists($name, Prodexa_AI_Test_State::$options)
        ? Prodexa_AI_Test_State::$options[$name]
        : $default;
}

function update_option(string $name, mixed $value, bool|string|null $autoload = null): bool
{
    Prodexa_AI_Test_State::$options[$name] = $value;

    return true;
}

function delete_option(string $name): bool
{
    unset(Prodexa_AI_Test_State::$options[$name]);

    return true;
}

function register_setting(string $group, string $name, array $args = []): void
{
    Prodexa_AI_Test_State::$registered_settings[$name] = ['group' => $group, 'args' => $args];
}

function register_activation_hook(string $file, callable $callback): void
{
    add_action('activate_plugin', $callback);
}

function register_deactivation_hook(string $file, callable $callback): void
{
    add_action('deactivate_plugin', $callback);
}

function plugin_dir_path(string $file): string
{
    return rtrim(str_replace('\\', '/', dirname($file)), '/') . '/';
}

function plugin_dir_url(string $file): string
{
    return 'https://example.com/wp-content/plugins/' . basename(dirname($file)) . '/';
}

function plugin_basename(string $file): string
{
    return basename(dirname($file)) . '/' . basename($file);
}

function load_plugin_textdomain(string $domain, bool $deprecated = false, string $path = ''): bool
{
    return true;
}

function is_admin(): bool
{
    return Prodexa_AI_Test_State::$is_admin;
}

function current_user_can(string $cap): bool
{
    return Prodexa_AI_Test_State::$can_manage && $cap === 'manage_options';
}

function home_url(string $path = ''): string
{
    return rtrim(Prodexa_AI_Test_State::$home_url, '/') . $path;
}

function __(string $text, string $domain = 'default'): string
{
    return $text;
}

function esc_html__(string $text, string $domain = 'default'): string
{
    return esc_html($text);
}

function esc_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_attr(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function sanitize_key(string $key): string
{
    $key = strtolower($key);

    return (string) preg_replace('/[^a-z0-9_\-]/', '', $key);
}

function sanitize_text_field(string $str): string
{
    $str = strip_tags($str);

    return trim($str);
}

function wp_unslash(mixed $value): mixed
{
    return $value;
}

function wp_die(string $message = '', string|int $title = '', array|int $args = []): void
{
    $status = 500;
    if (is_array($args) && isset($args['response'])) {
        $status = (int) $args['response'];
    }
    throw new RuntimeException('wp_die:' . $status . ':' . $message);
}

function deactivate_plugins(string $plugin): void
{
}

function add_options_page(string $title, string $menu, string $cap, string $slug, callable $callback): void
{
}

function settings_fields(string $group): void
{
    echo '<input type="hidden" name="option_page" value="' . esc_attr($group) . '" />';
    wp_nonce_field($group . '-options');
}

function settings_errors(string $setting = ''): void
{
    foreach (Prodexa_AI_Test_State::$settings_errors as $error) {
        if ($setting !== '' && $error['setting'] !== $setting) {
            continue;
        }
        echo '<div class="notice">' . esc_html($error['message']) . '</div>';
    }
}

function add_settings_error(string $setting, string $code, string $message, string $type = 'error'): void
{
    Prodexa_AI_Test_State::$settings_errors[] = [
        'setting' => $setting,
        'code' => $code,
        'message' => $message,
        'type' => $type,
    ];
}

function wp_nonce_field(string $action, string $name = '_wpnonce', bool $referer = true, bool $display = true): string
{
    $html = '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr('nonce-' . $action) . '" />';
    if ($display) {
        echo $html;
    }

    return $html;
}

function check_admin_referer(string $action, string $query_arg = '_wpnonce'): bool
{
    $nonce = isset($_REQUEST[$query_arg]) ? (string) $_REQUEST[$query_arg] : '';
    if ($nonce !== 'nonce-' . $action) {
        wp_die('Are you sure you want to do this?', '', ['response' => 403]);
    }

    return true;
}

function submit_button(
    string $text = 'Save Changes',
    string $type = 'primary',
    string $name = 'submit',
    bool $wrap = true,
    mixed $other = null,
): void {
    echo '<input type="submit" name="' . esc_attr($name) . '" value="' . esc_attr($text) . '" />';
}

function is_wp_error(mixed $thing): bool
{
    return $thing instanceof WP_Error;
}

function wp_remote_request(string $url, array $args = []): array|WP_Error
{
    return new WP_Error('http_request_not_executed', 'No transport configured.');
}

final class WP_Error
{
    public function __construct(
        private readonly string $code,
        private readonly string $message,
    ) {
    }

    public function get_error_code(): string
    {
        return $this->code;
    }

    public function get_error_message(): string
    {
        return $this->message;
    }
}

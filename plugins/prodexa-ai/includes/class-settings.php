<?php
/**
 * WordPress option storage for public settings and sealed secrets.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Settings
{
    public const GROUP = 'prodexa_ai';

    public const OPTION_SETTINGS = 'prodexa_ai_settings';

    public const OPTION_SECRETS = 'prodexa_ai_secrets';

    public const OPTION_SNAPSHOT = 'prodexa_ai_license_snapshot';

    public const CAPABILITY = 'manage_options';

    /**
     * @return array{backend_url: string, site_id: string, timeout: int}
     */
    public static function defaults(): array
    {
        return [
            'backend_url' => '',
            'site_id' => '',
            'timeout' => 10,
        ];
    }

    public function register(): void
    {
        register_setting(
            self::GROUP,
            self::OPTION_SETTINGS,
            [
                'type' => 'array',
                'sanitize_callback' => [$this, 'sanitize_settings'],
                'default' => self::defaults(),
                'show_in_rest' => false,
                'autoload' => false,
            ]
        );

        register_setting(
            self::GROUP,
            self::OPTION_SECRETS,
            [
                'type' => 'array',
                'sanitize_callback' => [$this, 'sanitize_secrets'],
                'default' => [
                    'site_secret' => '',
                    'license_key' => '',
                ],
                'show_in_rest' => false,
                'autoload' => false,
            ]
        );
    }

    /**
     * @param mixed $input
     * @return array{backend_url: string, site_id: string, timeout: int}
     */
    public function sanitize_settings(mixed $input): array
    {
        if (!is_array($input)) {
            return $this->get_public();
        }

        $current = $this->get_public();

        return [
            'backend_url' => Prodexa_AI_Sanitizer::sanitize_backend_url(
                isset($input['backend_url']) ? (string) $input['backend_url'] : $current['backend_url']
            ),
            'site_id' => Prodexa_AI_Sanitizer::sanitize_site_id(
                isset($input['site_id']) ? (string) $input['site_id'] : $current['site_id']
            ),
            'timeout' => Prodexa_AI_Sanitizer::sanitize_timeout(
                $input['timeout'] ?? $current['timeout'],
                $current['timeout']
            ),
        ];
    }

    /**
     * @param mixed $input
     * @return array{site_secret: string, license_key: string}
     */
    public function sanitize_secrets(mixed $input): array
    {
        $stored = $this->get_sealed();
        if (!is_array($input)) {
            return $stored;
        }

        $site_secret = $stored['site_secret'];
        if (!empty($input['clear_site_secret'])) {
            $site_secret = '';
        } elseif (isset($input['site_secret'])) {
            $incoming = Prodexa_AI_Sanitizer::sanitize_secret((string) $input['site_secret']);
            if ($incoming !== '') {
                $site_secret = Prodexa_AI_Secrets::seal($incoming);
            }
        }

        $license_key = $stored['license_key'];
        if (!empty($input['clear_license_key'])) {
            $license_key = '';
        } elseif (isset($input['license_key'])) {
            $incoming = Prodexa_AI_Sanitizer::sanitize_license_key((string) $input['license_key']);
            if ($incoming !== '') {
                $license_key = Prodexa_AI_Secrets::seal($incoming);
            }
        }

        return [
            'site_secret' => $site_secret,
            'license_key' => $license_key,
        ];
    }

    /**
     * @return array{backend_url: string, site_id: string, timeout: int}
     */
    public function get_public(): array
    {
        $stored = get_option(self::OPTION_SETTINGS, self::defaults());
        if (!is_array($stored)) {
            $stored = [];
        }

        return [
            'backend_url' => isset($stored['backend_url'])
                ? Prodexa_AI_Sanitizer::sanitize_backend_url((string) $stored['backend_url'])
                : '',
            'site_id' => isset($stored['site_id'])
                ? Prodexa_AI_Sanitizer::sanitize_site_id((string) $stored['site_id'])
                : '',
            'timeout' => Prodexa_AI_Sanitizer::sanitize_timeout($stored['timeout'] ?? 10),
        ];
    }

    public function backend_url(): string
    {
        return $this->get_public()['backend_url'];
    }

    public function site_id(): string
    {
        return $this->get_public()['site_id'];
    }

    public function timeout(): int
    {
        return $this->get_public()['timeout'];
    }

    public function site_secret(): string
    {
        return Prodexa_AI_Secrets::open($this->get_sealed()['site_secret']);
    }

    public function license_key(): string
    {
        return Prodexa_AI_Secrets::open($this->get_sealed()['license_key']);
    }

    public function has_site_secret(): bool
    {
        return $this->site_secret() !== '';
    }

    public function has_license_key(): bool
    {
        return $this->license_key() !== '';
    }

    public function has_site_credentials(): bool
    {
        return $this->site_id() !== '' && $this->has_site_secret();
    }

    /**
     * @return array<string, mixed>
     */
    public function get_snapshot(): array
    {
        $snapshot = get_option(self::OPTION_SNAPSHOT, []);

        return is_array($snapshot) ? $snapshot : [];
    }

    /**
     * @param array<string, mixed> $snapshot
     */
    public function save_snapshot(array $snapshot): void
    {
        update_option(self::OPTION_SNAPSHOT, $snapshot, false);
    }

    public function clear_snapshot(): void
    {
        delete_option(self::OPTION_SNAPSHOT);
    }

    /**
     * @return array{site_secret: string, license_key: string}
     */
    private function get_sealed(): array
    {
        $stored = get_option(self::OPTION_SECRETS, []);
        if (!is_array($stored)) {
            $stored = [];
        }

        return [
            'site_secret' => isset($stored['site_secret']) ? (string) $stored['site_secret'] : '',
            'license_key' => isset($stored['license_key']) ? (string) $stored['license_key'] : '',
        ];
    }
}

<?php
/**
 * Input sanitization and validation helpers.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Sanitizer
{
    public const SITE_ID_PATTERN = '/^sit_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

    public const DOMAIN_PATTERN = '/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/';

    public static function sanitize_backend_url(string $value): string
    {
        $value = trim($value);
        if ($value === '' || strlen($value) > 2048) {
            return '';
        }

        $parts = parse_url($value);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return '';
        }

        $scheme = strtolower((string) $parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            return '';
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return '';
        }

        $host = strtolower((string) $parts['host']);
        if ($host === '' || str_contains($host, '..') || str_contains($host, '[') || str_contains($host, ' ')) {
            return '';
        }

        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        $path = isset($parts['path']) ? rtrim((string) $parts['path'], '/') : '';
        if ($path === '/') {
            $path = '';
        }

        return $scheme . '://' . $host . $port . $path;
    }

    public static function is_loopback_url(string $url): bool
    {
        $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?? ''));

        return $host === 'localhost' || $host === '127.0.0.1';
    }

    public static function sanitize_site_id(string $value): string
    {
        $value = strtolower(trim($value));
        if ($value === '' || !preg_match(self::SITE_ID_PATTERN, $value)) {
            return '';
        }

        return $value;
    }

    public static function sanitize_timeout(mixed $value, int $default = 10): int
    {
        $timeout = is_numeric($value) ? (int) $value : $default;
        if ($timeout < 1) {
            return 1;
        }
        if ($timeout > 30) {
            return 30;
        }

        return $timeout;
    }

    public static function sanitize_secret(string $value): string
    {
        if (str_contains($value, "\0") || str_contains($value, "\n") || str_contains($value, "\r")) {
            return '';
        }
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        if (strlen($value) > 512) {
            return '';
        }

        return $value;
    }

    public static function sanitize_license_key(string $value): string
    {
        return self::sanitize_secret($value);
    }

    /**
     * Normalize a merchant host the same way as the API (apps/api site-domain).
     */
    public static function normalize_domain(string $input): ?string
    {
        $trimmed = strtolower(trim($input));
        if ($trimmed === '' || strlen($trimmed) > 253) {
            return null;
        }

        if (str_contains($trimmed, '://')) {
            $host = parse_url($trimmed, PHP_URL_HOST);
            if (!is_string($host) || $host === '') {
                return null;
            }
        } else {
            $without_path = explode('/', $trimmed, 2)[0];
            $without_query = explode('?', $without_path, 2)[0];
            if (str_contains($without_query, '@')) {
                $parts = explode('@', $without_query);
                $without_query = (string) end($parts);
            }
            $host = $without_query;
            if (str_starts_with($host, '[')) {
                return null;
            }
            if (str_contains($host, ':')) {
                $host = explode(':', $host, 2)[0];
            }
        }

        $host = strtolower($host);
        if (str_ends_with($host, '.')) {
            $host = substr($host, 0, -1);
        }
        if (str_starts_with($host, 'www.')) {
            $host = substr($host, 4);
        }

        if ($host === 'localhost') {
            return $host;
        }

        if (!preg_match(self::DOMAIN_PATTERN, $host) || str_contains($host, '..')) {
            return null;
        }

        return $host;
    }

    public static function join_url(string $base, string $path): string
    {
        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }
}

<?php
/**
 * Encrypt merchant site credentials at rest using WordPress salts.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Secrets
{
    private const PREFIX = 'v1:';

    public static function seal(string $plaintext): string
    {
        if ($plaintext === '') {
            return '';
        }

        $key = self::key();
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false || $tag === '') {
            return '';
        }

        return self::PREFIX . base64_encode($iv . $tag . $cipher);
    }

    public static function open(string $payload): string
    {
        if ($payload === '') {
            return '';
        }

        if (!str_starts_with($payload, self::PREFIX)) {
            return '';
        }

        $raw = base64_decode(substr($payload, strlen(self::PREFIX)), true);
        if (!is_string($raw) || strlen($raw) < 29) {
            return '';
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);

        return is_string($plain) ? $plain : '';
    }

    private static function key(): string
    {
        $material = '';
        foreach (['AUTH_KEY', 'SECURE_AUTH_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT'] as $constant) {
            if (defined($constant)) {
                $material .= (string) constant($constant);
            }
        }

        if ($material === '') {
            $material = 'prodexa-ai-insecure-fallback-do-not-use';
        }

        return hash('sha256', $material, true);
    }
}

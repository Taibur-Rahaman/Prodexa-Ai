<?php
/**
 * Site HMAC-SHA256 signer (DEC-018).
 *
 * No WordPress dependency so the canonical string can be tested against the API.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Hmac
{
    public const VERSION = 'v1';

    /**
     * @param array{
     *   method: string,
     *   path: string,
     *   timestamp: string,
     *   nonce: string,
     *   body: string,
     *   site_id: string
     * } $input
     */
    public static function canonical_string(array $input): string
    {
        return implode("\n", [
            self::VERSION,
            strtoupper($input['method']),
            $input['path'],
            $input['timestamp'],
            $input['nonce'],
            hash('sha256', $input['body']),
            $input['site_id'],
        ]);
    }

    /**
     * @param array{
     *   method: string,
     *   path: string,
     *   timestamp: string,
     *   nonce: string,
     *   body: string,
     *   site_id: string
     * } $input
     */
    public static function sign(string $secret, array $input): string
    {
        return hash_hmac('sha256', self::canonical_string($input), $secret);
    }
}

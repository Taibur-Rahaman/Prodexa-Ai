<?php
/**
 * Customer-safe mapping for POST /v1/discovery/select (DEC-019).
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Selection
{
    public const OFFER_ID_PATTERN = '/^off_[A-Za-z0-9._-]{1,120}$/';

    public const SELECTION_ID_PATTERN = '/^[A-Za-z0-9._-]{8,128}$/';

    public const EXPIRES_AT_PATTERN = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/';

    public const CUSTOMER_KEYS = [
        'selection_id',
        'offer_id',
        'expires_at',
    ];

    /**
     * @return array{ok: true, offer_id: string}|array{ok: false, code: string, message: string}
     */
    public static function parse_offer_id(mixed $offer_id): array
    {
        $sanitized = self::sanitize_offer_id($offer_id);
        if ($sanitized === null) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'offer_id is invalid.',
            ];
        }

        return [
            'ok' => true,
            'offer_id' => $sanitized,
        ];
    }

    public static function new_selection_id(): string
    {
        return 'sel_' . bin2hex(random_bytes(16));
    }

    public static function sanitize_offer_id(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);
        if ($trimmed === '' || preg_match(self::OFFER_ID_PATTERN, $trimmed) !== 1) {
            return null;
        }

        return $trimmed;
    }

    public static function sanitize_selection_id(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);
        if ($trimmed === '' || preg_match(self::SELECTION_ID_PATTERN, $trimmed) !== 1) {
            return null;
        }

        return $trimmed;
    }

    public static function sanitize_expires_at(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);
        if ($trimmed === '' || preg_match(self::EXPIRES_AT_PATTERN, $trimmed) !== 1) {
            return null;
        }

        return $trimmed;
    }

    /**
     * Project only the DEC-019 customer-safe select fields. Extra keys are dropped.
     *
     * @param array<string, mixed>|null $data
     * @return array{selection_id: string, offer_id: string, expires_at: string}|null
     */
    public static function project_response(?array $data): ?array
    {
        if (!is_array($data)) {
            return null;
        }

        $selection_id = self::sanitize_selection_id($data['selection_id'] ?? null);
        $offer_id = self::sanitize_offer_id($data['offer_id'] ?? null);
        $expires_at = self::sanitize_expires_at($data['expires_at'] ?? null);
        if ($selection_id === null || $offer_id === null || $expires_at === null) {
            return null;
        }

        $projected = [
            'selection_id' => $selection_id,
            'offer_id' => $offer_id,
            'expires_at' => $expires_at,
        ];

        foreach (array_keys($projected) as $key) {
            if (!in_array($key, self::CUSTOMER_KEYS, true)) {
                unset($projected[$key]);
            }
        }

        return $projected;
    }

    /**
     * Trusted WooCommerce order meta derived from an API select response.
     * Does not include offer_id, price, tenant, license, or payment fields.
     *
     * @param array{selection_id: string, offer_id: string, expires_at: string} $selection
     * @return array{_prodexa_selection_id: string, _prodexa_selection_expires_at: string}
     */
    public static function order_meta(array $selection): array
    {
        return [
            Prodexa_AI_WooCommerce::META_SELECTION_ID => $selection['selection_id'],
            Prodexa_AI_WooCommerce::META_EXPIRES_AT => $selection['expires_at'],
        ];
    }

    public static function user_message(string $code, string $fallback = ''): string
    {
        $safe_fallback = self::is_safe_api_message($fallback) ? $fallback : '';

        return match ($code) {
            'VALIDATION_ERROR' => $safe_fallback !== '' ? $safe_fallback : 'That offer could not be selected.',
            'OFFER_NOT_FOUND' => 'That offer is not available.',
            'OFFER_NOT_SELECTABLE' => 'That offer cannot be selected.',
            'SELECTION_EXPIRED' => 'That selection has expired. Search again and choose the offer.',
            'SELECTION_CONFLICT' => 'That selection is no longer valid. Search again and choose the offer.',
            'MISSING_CREDENTIALS', 'NOT_CONFIGURED' => 'Offer selection is not configured yet.',
            'LICENSE_REVOKED', 'LICENSE_SUSPENDED', 'LICENSE_PENDING', 'LICENSE_EXPIRED',
            'SITE_REVOKED', 'ACTIVATION_LIMIT_EXCEEDED' => 'Offer selection is not available for this store right now.',
            'FEATURE_NOT_ENTITLED' => 'Offer selection is not included on this plan.',
            'USAGE_LIMIT_EXCEEDED' => 'This store has reached its search limit. Try again later.',
            'RATE_LIMITED' => 'Too many requests. Please wait a moment and try again.',
            'UNAUTHENTICATED', 'AUTH_EXPIRED', 'AUTH_REPLAY' => 'Offer selection could not be authorized.',
            'STORE_UNAVAILABLE', 'TIMEOUT', 'UNREACHABLE', 'INVALID_RESPONSE' => 'The selected offer could not be confirmed. The rest of the store still works.',
            default => 'The selected offer could not be confirmed. The rest of the store still works.',
        };
    }

    private static function is_safe_api_message(string $message): bool
    {
        $known = [
            'offer_id is required.',
            'offer_id is invalid.',
            'selection_id is required.',
            'selection_id is invalid.',
            'Request body must be a JSON object.',
        ];

        return in_array($message, $known, true);
    }
}

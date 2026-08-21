<?php
/**
 * Customer-safe discovery request/response mapping for POST /v1/discovery/search.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Discovery
{
    public const QUERY_MAX_LENGTH = 200;

    public const TOKEN_MAX = 12;

    public const DEFAULT_PAGE = 1;

    public const DEFAULT_LIMIT = 10;

    public const MAX_LIMIT = 20;

    public const MAX_PAGE = 10000;

    public const AVAILABILITIES = ['in_stock', 'out_of_stock', 'preorder', 'unknown'];

    public const CUSTOMER_OFFER_KEYS = [
        'offer_id',
        'title',
        'image_url',
        'display_price',
        'currency',
        'availability',
        'freshness',
    ];

    /**
     * @return array{ok: true, query: string, page: int, limit: int}|array{ok: false, code: string, message: string}
     */
    public static function parse_request(mixed $query, mixed $page, mixed $limit): array
    {
        if (!is_string($query)) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'A search query is required.',
            ];
        }

        $trimmed = trim($query);
        if ($trimmed === '') {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'A search query is required.',
            ];
        }
        if (strlen($trimmed) > self::QUERY_MAX_LENGTH) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'Search query is too long.',
            ];
        }

        $tokens = preg_split('/\s+/', $trimmed, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($tokens) || $tokens === []) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'A search query is required.',
            ];
        }
        if (count($tokens) > self::TOKEN_MAX) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'Search query has too many terms.',
            ];
        }

        $parsed_page = self::parse_positive_int($page, self::DEFAULT_PAGE, self::MAX_PAGE);
        if ($parsed_page === null) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'page is invalid.',
            ];
        }

        $parsed_limit = self::parse_positive_int($limit, self::DEFAULT_LIMIT, self::MAX_LIMIT);
        if ($parsed_limit === null) {
            return [
                'ok' => false,
                'code' => 'VALIDATION_ERROR',
                'message' => 'limit is invalid.',
            ];
        }

        return [
            'ok' => true,
            'query' => implode(' ', $tokens),
            'page' => $parsed_page,
            'limit' => $parsed_limit,
        ];
    }

    public static function sanitize_limit(mixed $limit): int
    {
        return self::parse_positive_int($limit, self::DEFAULT_LIMIT, self::MAX_LIMIT) ?? self::DEFAULT_LIMIT;
    }

    /**
     * @param array{query: string, page: int, limit: int} $parsed
     * @return array{query: string, page: int, limit: int, context?: array{currency: string}}
     */
    public static function build_body(array $parsed, ?string $currency = null): array
    {
        $body = [
            'query' => $parsed['query'],
            'page' => $parsed['page'],
            'limit' => $parsed['limit'],
        ];

        $safe_currency = self::sanitize_currency($currency);
        if ($safe_currency !== null) {
            $body['context'] = [
                'currency' => $safe_currency,
            ];
        }

        return $body;
    }

    public static function store_currency(): ?string
    {
        if (!function_exists('get_woocommerce_currency')) {
            return null;
        }

        return self::sanitize_currency((string) get_woocommerce_currency());
    }

    public static function sanitize_currency(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $code = strtoupper(trim($value));
        if (preg_match('/^[A-Z]{3}$/', $code) !== 1) {
            return null;
        }

        return $code;
    }

    /**
     * Project only customer-safe fields from POST /v1/discovery/search.
     *
     * @param array<string, mixed>|null $data
     * @return array{request_id: ?string, results: list<array<string, mixed>>, meta: array{cached: bool, count: int}}
     */
    public static function project_response(?array $data, ?string $fallback_request_id = null): array
    {
        $request_id = $fallback_request_id;
        if (is_array($data) && isset($data['request_id']) && is_string($data['request_id']) && $data['request_id'] !== '') {
            $request_id = $data['request_id'];
        }

        $results = [];
        $raw_results = is_array($data) && isset($data['results']) && is_array($data['results'])
            ? $data['results']
            : [];
        foreach ($raw_results as $row) {
            if (!is_array($row)) {
                continue;
            }
            $offer = self::project_offer($row);
            if ($offer !== null) {
                $results[] = $offer;
            }
        }

        $cached = false;
        if (is_array($data) && isset($data['meta']) && is_array($data['meta'])) {
            $cached = $data['meta']['cached'] === true;
        }

        return [
            'request_id' => $request_id,
            'results' => $results,
            'meta' => [
                'cached' => $cached,
                'count' => count($results),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array{
     *   offer_id: string,
     *   title: string,
     *   image_url: ?string,
     *   display_price: float|int,
     *   currency: string,
     *   availability: string,
     *   freshness: array{retrieved_at: string}
     * }|null
     */
    public static function project_offer(array $row): ?array
    {
        $offer_id = self::sanitize_plain_text($row['offer_id'] ?? null, 128);
        $title = self::sanitize_plain_text($row['title'] ?? null, 500);
        $currency = self::sanitize_currency($row['currency'] ?? null);
        $availability = self::sanitize_availability($row['availability'] ?? null);
        $price = self::sanitize_price($row['display_price'] ?? null);
        $retrieved_at = '';
        if (isset($row['freshness']) && is_array($row['freshness'])) {
            $retrieved_at = self::sanitize_plain_text($row['freshness']['retrieved_at'] ?? null, 64) ?? '';
        }

        if ($offer_id === null || $title === null || $currency === null || $availability === null || $price === null || $retrieved_at === '') {
            return null;
        }

        $offer = [
            'offer_id' => $offer_id,
            'title' => $title,
            'image_url' => Prodexa_AI_Sanitizer::sanitize_public_http_url(
                isset($row['image_url']) && is_string($row['image_url']) ? $row['image_url'] : ''
            ) ?: null,
            'display_price' => $price,
            'currency' => $currency,
            'availability' => $availability,
            'freshness' => [
                'retrieved_at' => $retrieved_at,
            ],
        ];

        foreach (array_keys($offer) as $key) {
            if (!in_array($key, self::CUSTOMER_OFFER_KEYS, true)) {
                unset($offer[$key]);
            }
        }

        return $offer;
    }

    public static function user_message(string $code, string $fallback = ''): string
    {
        $safe_fallback = self::is_safe_api_message($fallback) ? $fallback : '';

        return match ($code) {
            'VALIDATION_ERROR' => $safe_fallback !== '' ? $safe_fallback : 'Enter a valid search.',
            'MISSING_CREDENTIALS', 'NOT_CONFIGURED' => 'Product search is not configured yet.',
            'LICENSE_REVOKED', 'LICENSE_SUSPENDED', 'LICENSE_PENDING', 'LICENSE_EXPIRED',
            'SITE_REVOKED', 'ACTIVATION_LIMIT_EXCEEDED' => 'Product search is not available for this store right now.',
            'FEATURE_NOT_ENTITLED' => 'Product search is not included on this plan.',
            'USAGE_LIMIT_EXCEEDED' => 'This store has reached its search limit. Try again later.',
            'RATE_LIMITED' => 'Too many searches. Please wait a moment and try again.',
            'UNAUTHENTICATED', 'AUTH_EXPIRED', 'AUTH_REPLAY' => 'Product search could not be authorized.',
            'STORE_UNAVAILABLE', 'TIMEOUT', 'UNREACHABLE' => 'Product search is temporarily unavailable. The rest of the store still works.',
            default => 'Product search is temporarily unavailable. The rest of the store still works.',
        };
    }

    private static function is_safe_api_message(string $message): bool
    {
        $known = [
            'A search query is required.',
            'Search query is too long.',
            'Search query has too many terms.',
            'page is invalid.',
            'limit is invalid.',
            'context must be an object.',
            'context.country must be an ISO 3166-1 alpha-2 code.',
            'context.currency must be an ISO 4217 code.',
            'Request body must be a JSON object.',
        ];

        return in_array($message, $known, true);
    }

    private static function parse_positive_int(mixed $value, int $fallback, int $maximum): ?int
    {
        if ($value === null || $value === '') {
            return $fallback;
        }
        if (is_int($value)) {
            $parsed = $value;
        } elseif (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1) {
            $parsed = (int) $value;
        } elseif (is_float($value) && floor($value) === $value) {
            $parsed = (int) $value;
        } else {
            return null;
        }
        if ($parsed < 1 || $parsed > $maximum) {
            return null;
        }

        return $parsed;
    }

    private static function sanitize_plain_text(mixed $value, int $max_length): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $text = trim(wp_strip_all_tags($value));
        $text = str_replace("\0", '', $text);
        if ($text === '' || strlen($text) > $max_length) {
            return $text === '' ? null : substr($text, 0, $max_length);
        }

        return $text;
    }

    private static function sanitize_availability(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $value = strtolower(trim($value));

        return in_array($value, self::AVAILABILITIES, true) ? $value : null;
    }

    private static function sanitize_price(mixed $value): float|int|null
    {
        if (is_int($value) && $value >= 0) {
            return $value;
        }
        if (is_float($value) && is_finite($value) && $value >= 0) {
            return $value;
        }
        if (is_string($value) && is_numeric($value)) {
            $parsed = (float) $value;
            if (is_finite($parsed) && $parsed >= 0) {
                return $parsed;
            }
        }

        return null;
    }
}

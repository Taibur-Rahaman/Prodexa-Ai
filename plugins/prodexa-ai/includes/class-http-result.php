<?php
/**
 * Structured HTTP client result. Never includes secrets.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Http_Result
{
    public function __construct(
        public readonly bool $ok,
        public readonly int $http_status,
        public readonly ?array $data,
        public readonly ?string $error_code,
        public readonly string $message,
        public readonly ?string $request_id,
    ) {
    }

    public static function failure(
        string $code,
        string $message,
        int $http_status = 0,
        ?string $request_id = null,
        ?array $data = null,
    ): self {
        return new self(false, $http_status, $data, $code, $message, $request_id);
    }

    public static function success(array $data, int $http_status, ?string $request_id): self
    {
        return new self(true, $http_status, $data, null, '', $request_id);
    }
}

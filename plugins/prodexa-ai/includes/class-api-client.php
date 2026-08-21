<?php
/**
 * WordPress HTTP client for the hosted Prodexa API.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Api_Client
{
    public const HEALTH_PATH = '/v1/health';

    public const LICENSE_VALIDATE_PATH = '/v1/license/validate';

    /**
     * @param callable(string, array<string, mixed>): mixed|null $transport
     */
    public function __construct(
        private readonly Prodexa_AI_Settings $settings,
        private $transport = null,
    ) {
    }

    public function health(): Prodexa_AI_Http_Result
    {
        return $this->request('GET', self::HEALTH_PATH, null, false);
    }

    /**
     * @param array<string, mixed> $body
     */
    public function validate_license(array $body): Prodexa_AI_Http_Result
    {
        if (!$this->settings->has_site_credentials()) {
            return Prodexa_AI_Http_Result::failure(
                'MISSING_CREDENTIALS',
                'A site ID and site secret are required before the plugin can call protected Prodexa endpoints.'
            );
        }

        return $this->request('POST', self::LICENSE_VALIDATE_PATH, $body, true);
    }

    /**
     * @param array<string, mixed>|null $body
     */
    public function request(string $method, string $path, ?array $body, bool $signed): Prodexa_AI_Http_Result
    {
        $base = $this->settings->backend_url();
        if ($base === '') {
            return Prodexa_AI_Http_Result::failure(
                'NOT_CONFIGURED',
                'Set the Prodexa API base URL before testing connectivity.'
            );
        }

        $method = strtoupper($method);
        $url = Prodexa_AI_Sanitizer::join_url($base, $path);
        $raw_body = '';
        if ($body !== null) {
            $encoded = json_encode($body, JSON_UNESCAPED_SLASHES);
            if (!is_string($encoded)) {
                return Prodexa_AI_Http_Result::failure(
                    'INVALID_REQUEST',
                    'The request body could not be encoded.'
                );
            }
            $raw_body = $encoded;
        }

        $request_id = self::new_request_id();
        $headers = [
            'Accept' => 'application/json',
            'x-request-id' => $request_id,
        ];
        if ($raw_body !== '') {
            $headers['Content-Type'] = 'application/json';
        }

        if ($signed) {
            $site_id = $this->settings->site_id();
            $secret = $this->settings->site_secret();
            $timestamp = (string) time();
            $nonce = bin2hex(random_bytes(16));
            $headers['x-prodexa-site-id'] = $site_id;
            $headers['x-prodexa-timestamp'] = $timestamp;
            $headers['x-prodexa-nonce'] = $nonce;
            $headers['x-prodexa-signature'] = Prodexa_AI_Hmac::sign($secret, [
                'method' => $method,
                'path' => $path,
                'timestamp' => $timestamp,
                'nonce' => $nonce,
                'body' => $raw_body,
                'site_id' => $site_id,
            ]);
        }

        $args = [
            'method' => $method,
            'timeout' => $this->settings->timeout(),
            'redirection' => 0,
            'httpversion' => '1.1',
            'headers' => $headers,
            'body' => $raw_body,
            'sslverify' => !Prodexa_AI_Sanitizer::is_loopback_url($base),
            'user-agent' => 'Prodexa-AI-Plugin/' . PRODEXA_AI_VERSION,
        ];

        $response = $this->dispatch($url, $args);

        return $this->interpret($response, $request_id);
    }

    public static function new_request_id(): string
    {
        return 'req_' . bin2hex(random_bytes(12));
    }

    /**
     * @param array<string, mixed> $args
     */
    private function dispatch(string $url, array $args): mixed
    {
        if (is_callable($this->transport)) {
            return ($this->transport)($url, $args);
        }

        return wp_remote_request($url, $args);
    }

    private function interpret(mixed $response, string $request_id): Prodexa_AI_Http_Result
    {
        if (is_array($response) && isset($response['error']) && is_string($response['error'])) {
            return $this->transport_error($response['error'], $request_id);
        }

        if (function_exists('is_wp_error') && is_wp_error($response)) {
            $code = (string) $response->get_error_code();

            return $this->transport_error($code, $request_id);
        }

        $status = 0;
        $raw = '';
        $response_headers = [];

        if (is_array($response)) {
            $status = isset($response['response']['code']) ? (int) $response['response']['code'] : (int) ($response['status'] ?? 0);
            $raw = isset($response['body']) ? (string) $response['body'] : '';
            $response_headers = isset($response['headers']) && is_array($response['headers'])
                ? $response['headers']
                : [];
        }

        $header_request_id = $this->header_value($response_headers, 'x-request-id') ?? $request_id;
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return Prodexa_AI_Http_Result::failure(
                'INVALID_RESPONSE',
                'The Prodexa API returned a response that could not be read.',
                $status,
                $header_request_id
            );
        }

        if ($status >= 200 && $status < 300) {
            return Prodexa_AI_Http_Result::success($decoded, $status, $header_request_id);
        }

        $error = isset($decoded['error']) && is_array($decoded['error']) ? $decoded['error'] : [];
        $code = isset($error['code']) && is_string($error['code']) ? $error['code'] : 'API_ERROR';
        $message = isset($error['message']) && is_string($error['message'])
            ? $error['message']
            : 'The Prodexa API returned an error.';
        $error_request_id = isset($error['request_id']) && is_string($error['request_id'])
            ? $error['request_id']
            : $header_request_id;

        return Prodexa_AI_Http_Result::failure(
            $code,
            $this->safe_message($message),
            $status,
            $error_request_id,
            $decoded
        );
    }

    private function transport_error(string $code, string $request_id): Prodexa_AI_Http_Result
    {
        $normalized = strtolower($code);
        if (str_contains($normalized, 'timeout')) {
            return Prodexa_AI_Http_Result::failure(
                'TIMEOUT',
                'The Prodexa API request timed out.',
                0,
                $request_id
            );
        }

        return Prodexa_AI_Http_Result::failure(
            'UNREACHABLE',
            'The Prodexa API could not be reached. Existing store functionality is unaffected.',
            0,
            $request_id
        );
    }

    /**
     * @param array<string, mixed> $headers
     */
    private function header_value(array $headers, string $name): ?string
    {
        foreach ($headers as $key => $value) {
            if (strtolower((string) $key) !== strtolower($name)) {
                continue;
            }
            if (is_array($value)) {
                $value = $value[0] ?? '';
            }

            return is_string($value) && $value !== '' ? $value : null;
        }

        return null;
    }

    private function safe_message(string $message): string
    {
        $message = trim($message);
        if ($message === '' || preg_match('/password|secret|token|authorization|api[_-]?key/i', $message) === 1) {
            return 'The Prodexa API returned an error.';
        }

        return $message;
    }
}

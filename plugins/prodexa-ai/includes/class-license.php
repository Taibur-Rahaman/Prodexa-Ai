<?php
/**
 * License configuration boundary. The hosted API remains authoritative.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_License
{
    public function __construct(
        private readonly Prodexa_AI_Settings $settings,
        private readonly Prodexa_AI_Api_Client $client,
    ) {
    }

    /**
     * Cached plugin state is display-only and must never authorize protected work.
     */
    public function cached_state_authorizes_access(): bool
    {
        return false;
    }

    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $stored = $this->settings->get_snapshot();

        return [
            'valid' => !empty($stored['valid']),
            'status' => isset($stored['status']) && is_string($stored['status']) ? $stored['status'] : '',
            'plan_code' => isset($stored['plan_code']) && is_string($stored['plan_code']) ? $stored['plan_code'] : '',
            'plan_name' => isset($stored['plan_name']) && is_string($stored['plan_name']) ? $stored['plan_name'] : '',
            'expires_at' => isset($stored['expires_at']) && is_string($stored['expires_at']) ? $stored['expires_at'] : '',
            'request_id' => isset($stored['request_id']) && is_string($stored['request_id']) ? $stored['request_id'] : '',
            'checked_at' => isset($stored['checked_at']) && is_string($stored['checked_at']) ? $stored['checked_at'] : '',
            'error_code' => isset($stored['error_code']) && is_string($stored['error_code']) ? $stored['error_code'] : '',
            'message' => isset($stored['message']) && is_string($stored['message']) ? $stored['message'] : '',
        ];
    }

    public function current_domain(): ?string
    {
        $home = function_exists('home_url') ? home_url() : '';

        return Prodexa_AI_Sanitizer::normalize_domain($home);
    }

    public function refresh_from_api(): Prodexa_AI_Http_Result
    {
        $domain = $this->current_domain();
        if ($domain === null) {
            return Prodexa_AI_Http_Result::failure(
                'VALIDATION_ERROR',
                'This WordPress site does not have a domain the Prodexa API can bind to.'
            );
        }

        $result = $this->client->validate_license([
            'domain' => $domain,
        ]);

        if ($result->ok && is_array($result->data)) {
            $plan = isset($result->data['plan']) && is_array($result->data['plan']) ? $result->data['plan'] : [];
            $this->settings->save_snapshot([
                'valid' => !empty($result->data['valid']),
                'status' => isset($result->data['status']) && is_string($result->data['status'])
                    ? $result->data['status']
                    : '',
                'plan_code' => isset($plan['code']) && is_string($plan['code']) ? $plan['code'] : '',
                'plan_name' => isset($plan['name']) && is_string($plan['name']) ? $plan['name'] : '',
                'expires_at' => isset($result->data['expires_at']) && is_string($result->data['expires_at'])
                    ? $result->data['expires_at']
                    : '',
                'request_id' => $result->request_id ?? '',
                'checked_at' => gmdate('c'),
                'error_code' => '',
                'message' => '',
            ]);

            return $result;
        }

        $this->settings->save_snapshot([
            'valid' => false,
            'status' => '',
            'plan_code' => '',
            'plan_name' => '',
            'expires_at' => '',
            'request_id' => $result->request_id ?? '',
            'checked_at' => gmdate('c'),
            'error_code' => $result->error_code ?? 'API_ERROR',
            'message' => $result->message,
        ]);

        return $result;
    }
}

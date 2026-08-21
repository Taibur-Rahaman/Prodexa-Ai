<?php
/**
 * WooCommerce order metadata for a validated Prodexa selection reference (DEC-020).
 *
 * Does not implement payment, pricing, product sync, or checkout totals.
 * Client-supplied Prodexa prices are never trusted (DEC-021).
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Checkout_Exception extends RuntimeException
{
    public function __construct(
        public readonly string $error_code,
        string $message,
    ) {
        parent::__construct($message);
    }
}

final class Prodexa_AI_WooCommerce
{
    public const SESSION_KEY = 'prodexa_pending_selection';

    public const META_SELECTION_ID = '_prodexa_selection_id';

    public const META_EXPIRES_AT = '_prodexa_selection_expires_at';

    /**
     * @param object|null $session Optional session with get/set, used by tests.
     */
    public function __construct(
        private readonly Prodexa_AI_Api_Client $client,
        private readonly ?object $session = null,
    ) {
    }

    public function register(): void
    {
        add_action('woocommerce_checkout_create_order', [$this, 'attach_selection_to_order'], 10, 2);
        add_action(
            'woocommerce_store_api_checkout_update_order_from_request',
            [$this, 'attach_selection_to_store_api_order'],
            10,
            2
        );
        add_filter('woocommerce_checkout_posted_data', [$this, 'strip_posted_data'], 10, 1);
        add_filter('is_protected_meta', [$this, 'protect_meta'], 10, 2);
    }

    /**
     * Store a just-validated selection for later checkout. Session values stay untrusted
     * until attach_selection_to_order revalidates them via HMAC POST /v1/discovery/select.
     *
     * @param array<string, mixed> $selection
     */
    public function remember_pending(array $selection): bool
    {
        $session = $this->session();
        if ($session === null) {
            return false;
        }

        $projected = Prodexa_AI_Selection::project_response($selection);
        if ($projected === null) {
            return false;
        }

        if (
            method_exists($session, 'has_session')
            && method_exists($session, 'set_customer_session_cookie')
            && !$session->has_session()
        ) {
            $session->set_customer_session_cookie(true);
        }

        $session->set(self::SESSION_KEY, $projected);

        return true;
    }

    public function clear_pending(): void
    {
        $session = $this->session();
        if ($session === null) {
            return;
        }
        $session->set(self::SESSION_KEY, null);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function strip_posted_data(array $data): array
    {
        foreach (array_keys($data) as $key) {
            $name = (string) $key;
            if (str_starts_with($name, 'prodexa_') || str_starts_with($name, '_prodexa_')) {
                unset($data[$key]);
            }
        }

        return $data;
    }

    public function protect_meta(bool $protected, string $meta_key): bool
    {
        if (str_starts_with($meta_key, '_prodexa_')) {
            return true;
        }

        return $protected;
    }

    /**
     * Validate the pending selection against the API, then persist only the
     * selection reference. Runs before classic checkout saves the order.
     */
    public function attach_selection_to_order(object $order, mixed $data = null): void
    {
        unset($data);
        $this->strip_untrusted_meta($order);

        $pending = $this->read_pending();
        if ($pending['present'] !== true) {
            return;
        }
        if ($pending['selection'] === null) {
            $this->clear_pending();
            throw new Prodexa_AI_Checkout_Exception(
                'VALIDATION_ERROR',
                Prodexa_AI_Selection::user_message('VALIDATION_ERROR', 'offer_id is invalid.')
            );
        }

        $verified = $this->revalidate($pending['selection']);
        if ($verified['ok'] !== true) {
            $this->clear_pending();
            throw new Prodexa_AI_Checkout_Exception($verified['code'], $verified['message']);
        }

        foreach (Prodexa_AI_Selection::order_meta($verified['selection']) as $key => $value) {
            $order->update_meta_data($key, $value);
        }

        $this->clear_pending();
    }

    public function attach_selection_to_store_api_order(object $order, mixed $request = null): void
    {
        unset($request);
        try {
            $this->attach_selection_to_order($order, null);
        } catch (Prodexa_AI_Checkout_Exception $exception) {
            $route = '\\Automattic\\WooCommerce\\StoreApi\\Exceptions\\RouteException';
            if (class_exists($route)) {
                throw new $route('prodexa_selection', $exception->getMessage(), 400);
            }
            throw $exception;
        }
    }

    /**
     * @return array{present: bool, selection: array{selection_id: string, offer_id: string, expires_at: string}|null}
     */
    public function read_pending(): array
    {
        $session = $this->session();
        if ($session === null) {
            return ['present' => false, 'selection' => null];
        }

        $raw = $session->get(self::SESSION_KEY);
        if ($raw === null || $raw === '' || $raw === false) {
            return ['present' => false, 'selection' => null];
        }

        $projected = is_array($raw) ? Prodexa_AI_Selection::project_response($raw) : null;

        return [
            'present' => true,
            'selection' => $projected,
        ];
    }

    /**
     * Replay POST /v1/discovery/select with the session selection_id + offer_id.
     * Persisted fields come from the API response, never from the client.
     *
     * @param array{selection_id: string, offer_id: string, expires_at: string} $pending
     * @return array{ok: true, selection: array{selection_id: string, offer_id: string, expires_at: string}}|array{ok: false, code: string, message: string}
     */
    public function revalidate(array $pending): array
    {
        $result = $this->client->select([
            'offer_id' => $pending['offer_id'],
            'selection_id' => $pending['selection_id'],
        ]);

        if (!$result->ok) {
            $code = $result->error_code ?? 'API_ERROR';

            return [
                'ok' => false,
                'code' => $code,
                'message' => Prodexa_AI_Selection::user_message($code, $result->message),
            ];
        }

        $projected = Prodexa_AI_Selection::project_response($result->data);
        if ($projected === null) {
            return [
                'ok' => false,
                'code' => 'INVALID_RESPONSE',
                'message' => Prodexa_AI_Selection::user_message('INVALID_RESPONSE'),
            ];
        }

        if ($projected['selection_id'] !== $pending['selection_id'] || $projected['offer_id'] !== $pending['offer_id']) {
            return [
                'ok' => false,
                'code' => 'SELECTION_CONFLICT',
                'message' => Prodexa_AI_Selection::user_message('SELECTION_CONFLICT'),
            ];
        }

        return [
            'ok' => true,
            'selection' => $projected,
        ];
    }

    private function strip_untrusted_meta(object $order): void
    {
        if (!method_exists($order, 'delete_meta_data')) {
            return;
        }

        $keys = [
            self::META_SELECTION_ID,
            self::META_EXPIRES_AT,
            '_prodexa_offer_id',
            '_prodexa_price',
            '_prodexa_display_price',
            '_prodexa_currency',
            '_prodexa_tenant_id',
            '_prodexa_site_id',
            '_prodexa_license',
            '_prodexa_source_url',
            '_prodexa_source_id',
            '_prodexa_payment',
            'prodexa_selection_id',
            'prodexa_price',
        ];

        if (method_exists($order, 'get_meta_data')) {
            $meta = $order->get_meta_data();
            if (is_array($meta)) {
                foreach ($meta as $item) {
                    $key = '';
                    if (is_object($item) && isset($item->key) && is_string($item->key)) {
                        $key = $item->key;
                    } elseif (is_array($item) && isset($item['key']) && is_string($item['key'])) {
                        $key = $item['key'];
                    }
                    if ($key !== '' && (str_starts_with($key, '_prodexa_') || str_starts_with($key, 'prodexa_'))) {
                        $keys[] = $key;
                    }
                }
            }
        }

        foreach (array_unique($keys) as $key) {
            $order->delete_meta_data($key);
        }
    }

    private function session(): ?object
    {
        if (is_object($this->session) && method_exists($this->session, 'get') && method_exists($this->session, 'set')) {
            return $this->session;
        }

        if (!function_exists('WC')) {
            return null;
        }

        $wc = WC();
        if (!is_object($wc) || !isset($wc->session) || !is_object($wc->session)) {
            return null;
        }
        if (!method_exists($wc->session, 'get') || !method_exists($wc->session, 'set')) {
            return null;
        }

        return $wc->session;
    }
}

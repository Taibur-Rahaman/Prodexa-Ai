<?php
/**
 * Shared assertions for the plugin test runner.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

final class Prodexa_AI_Test_Case
{
    public static int $passed = 0;

    public static int $failed = 0;

    /** @var list<string> */
    public static array $failures = [];

    public static function assert_true(bool $condition, string $message): void
    {
        if ($condition) {
            self::$passed++;
            return;
        }
        self::$failed++;
        self::$failures[] = $message;
        fwrite(STDERR, "FAIL: {$message}\n");
    }

    public static function assert_same(mixed $expected, mixed $actual, string $message): void
    {
        if ($expected === $actual) {
            self::$passed++;
            return;
        }
        self::$failed++;
        $encoded_expected = var_export($expected, true);
        $encoded_actual = var_export($actual, true);
        $detail = "{$message} (expected {$encoded_expected}, got {$encoded_actual})";
        self::$failures[] = $detail;
        fwrite(STDERR, "FAIL: {$detail}\n");
    }

    /**
     * @return array{type: 'json', payload: array{response: mixed, status: ?int}}|array{type: 'die', message: string}
     */
    public static function capture_wp_response(callable $callback): array
    {
        Prodexa_AI_Test_State::$json = null;
        try {
            $callback();
        } catch (RuntimeException $exception) {
            if (str_starts_with($exception->getMessage(), 'wp_die:')) {
                return [
                    'type' => 'die',
                    'message' => $exception->getMessage(),
                ];
            }
            if (str_contains($exception->getMessage(), 'wp_send_json')) {
                return [
                    'type' => 'json',
                    'payload' => Prodexa_AI_Test_State::$json ?? ['response' => null, 'status' => null],
                ];
            }
            throw $exception;
        }

        return [
            'type' => 'json',
            'payload' => Prodexa_AI_Test_State::$json ?? ['response' => null, 'status' => null],
        ];
    }

    public static function assert_false(bool $condition, string $message): void
    {
        self::assert_true(!$condition, $message);
    }
}

final class Prodexa_AI_Test_Session
{
    /** @var array<string, mixed> */
    public array $store = [];

    public function get(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, $this->store) ? $this->store[$key] : $default;
    }

    public function set(string $key, mixed $value): void
    {
        $this->store[$key] = $value;
    }
}

final class Prodexa_AI_Test_Order
{
    /** @var array<string, mixed> */
    public array $meta = [];

    public function update_meta_data(string $key, mixed $value): void
    {
        $this->meta[$key] = $value;
    }

    public function delete_meta_data(string $key): void
    {
        unset($this->meta[$key]);
    }

    public function get_meta(string $key, bool $single = true): mixed
    {
        unset($single);

        return $this->meta[$key] ?? '';
    }

    /**
     * @return list<object{key: string}>
     */
    public function get_meta_data(): array
    {
        $rows = [];
        foreach ($this->meta as $key => $value) {
            $rows[] = (object) ['key' => $key, 'value' => $value];
        }

        return $rows;
    }
}

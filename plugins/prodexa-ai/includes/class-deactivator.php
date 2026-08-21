<?php
/**
 * Safe plugin deactivation. Settings and secrets are kept until uninstall.
 *
 * @package Prodexa_AI
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Prodexa_AI_Deactivator
{
    public static function deactivate(): void
    {
        // Intentionally leave options in place so reactivation does not drop credentials.
    }
}

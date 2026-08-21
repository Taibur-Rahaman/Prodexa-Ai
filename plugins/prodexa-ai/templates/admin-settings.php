<?php
/**
 * Admin settings template. All output is escaped. Secret fields are never prefilled.
 *
 * @package Prodexa_AI
 *
 * @var array{
 *   backend_url: string,
 *   site_id: string,
 *   timeout: int,
 *   has_site_secret: bool,
 *   has_license_key: bool,
 *   https_warning: bool,
 *   snapshot: array<string, mixed>,
 *   health_action: string,
 *   license_action: string,
 *   option_group: string
 * } $view
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

$snapshot = $view['snapshot'];
?>
<div class="wrap">
    <h1><?php echo esc_html__('Prodexa AI', 'prodexa-ai'); ?></h1>
    <p><?php echo esc_html__('This plugin is a client. The hosted Prodexa API is authoritative for licensing, authorization, tenant state, and discovery.', 'prodexa-ai'); ?></p>

    <?php settings_errors('prodexa_ai'); ?>

    <?php if ($view['https_warning']) : ?>
        <div class="notice notice-warning">
            <p><?php echo esc_html__('The configured API URL is not HTTPS. Production sites should use HTTPS only.', 'prodexa-ai'); ?></p>
        </div>
    <?php endif; ?>

    <form method="post" action="options.php" autocomplete="off">
        <?php settings_fields($view['option_group']); ?>
        <h2><?php echo esc_html__('API connection', 'prodexa-ai'); ?></h2>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="prodexa_ai_backend_url"><?php echo esc_html__('API base URL', 'prodexa-ai'); ?></label>
                </th>
                <td>
                    <input
                        name="prodexa_ai_settings[backend_url]"
                        id="prodexa_ai_backend_url"
                        type="url"
                        class="regular-text code"
                        value="<?php echo esc_attr($view['backend_url']); ?>"
                        placeholder="http://localhost:8000"
                    />
                    <p class="description">
                        <?php echo esc_html__('Local default is http://localhost:8000. Do not assume a production API hostname exists until it is verified.', 'prodexa-ai'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="prodexa_ai_timeout"><?php echo esc_html__('Request timeout (seconds)', 'prodexa-ai'); ?></label>
                </th>
                <td>
                    <input
                        name="prodexa_ai_settings[timeout]"
                        id="prodexa_ai_timeout"
                        type="number"
                        min="1"
                        max="30"
                        value="<?php echo esc_attr((string) $view['timeout']); ?>"
                    />
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="prodexa_ai_site_id"><?php echo esc_html__('Site ID', 'prodexa-ai'); ?></label>
                </th>
                <td>
                    <input
                        name="prodexa_ai_settings[site_id]"
                        id="prodexa_ai_site_id"
                        type="text"
                        class="regular-text code"
                        value="<?php echo esc_attr($view['site_id']); ?>"
                        placeholder="sit_"
                        autocomplete="off"
                    />
                    <p class="description">
                        <?php echo esc_html__('Public site identifier issued by Prodexa (sit_ + UUID). This is not a secret, but it is not visitor-facing.', 'prodexa-ai'); ?>
                    </p>
                </td>
            </tr>
        </table>

        <h2><?php echo esc_html__('Site credentials', 'prodexa-ai'); ?></h2>
        <p><?php echo esc_html__('The site secret and license key stay on this WordPress server. They are never printed into the storefront or admin JavaScript.', 'prodexa-ai'); ?></p>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="prodexa_ai_site_secret"><?php echo esc_html__('Site secret', 'prodexa-ai'); ?></label>
                </th>
                <td>
                    <input
                        name="prodexa_ai_secrets[site_secret]"
                        id="prodexa_ai_site_secret"
                        type="password"
                        class="regular-text"
                        value=""
                        autocomplete="new-password"
                    />
                    <?php if ($view['has_site_secret']) : ?>
                        <p class="description"><?php echo esc_html__('A site secret is stored. Leave blank to keep it, or enter a new value to replace it.', 'prodexa-ai'); ?></p>
                        <label>
                            <input type="checkbox" name="prodexa_ai_secrets[clear_site_secret]" value="1" />
                            <?php echo esc_html__('Remove stored site secret', 'prodexa-ai'); ?>
                        </label>
                    <?php else : ?>
                        <p class="description"><?php echo esc_html__('Paste the site secret issued with this site ID. Activation endpoints are not implemented yet; operators provision credentials in the API.', 'prodexa-ai'); ?></p>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="prodexa_ai_license_key"><?php echo esc_html__('License key', 'prodexa-ai'); ?></label>
                </th>
                <td>
                    <input
                        name="prodexa_ai_secrets[license_key]"
                        id="prodexa_ai_license_key"
                        type="password"
                        class="regular-text"
                        value=""
                        autocomplete="new-password"
                    />
                    <?php if ($view['has_license_key']) : ?>
                        <p class="description"><?php echo esc_html__('A license key is stored. Leave blank to keep it. Stored keys are not treated as proof of a valid subscription.', 'prodexa-ai'); ?></p>
                        <label>
                            <input type="checkbox" name="prodexa_ai_secrets[clear_license_key]" value="1" />
                            <?php echo esc_html__('Remove stored license key', 'prodexa-ai'); ?>
                        </label>
                    <?php else : ?>
                        <p class="description"><?php echo esc_html__('Stored for a future activate/deactivate API. POST /v1/license/activate is not implemented yet.', 'prodexa-ai'); ?></p>
                    <?php endif; ?>
                </td>
            </tr>
        </table>
        <?php submit_button(__('Save settings', 'prodexa-ai')); ?>
    </form>

    <h2><?php echo esc_html__('Connectivity', 'prodexa-ai'); ?></h2>
    <p><?php echo esc_html__('Calls GET /v1/health on the configured local or hosted API. This does not deploy anything and does not prove a license is valid.', 'prodexa-ai'); ?></p>
    <form method="post" action="">
        <?php wp_nonce_field($view['health_action']); ?>
        <input type="hidden" name="prodexa_ai_action" value="health" />
        <?php submit_button(__('Check API connection', 'prodexa-ai'), 'secondary', 'submit', false); ?>
    </form>

    <h2><?php echo esc_html__('License status', 'prodexa-ai'); ?></h2>
    <p><?php echo esc_html__('Refresh calls POST /v1/license/validate. The API decides tenant, license, and entitlement. The values below are an operator display only.', 'prodexa-ai'); ?></p>
    <table class="widefat striped" role="presentation">
        <tbody>
            <tr>
                <th><?php echo esc_html__('Valid (last API response)', 'prodexa-ai'); ?></th>
                <td><?php echo !empty($snapshot['valid']) ? esc_html__('yes', 'prodexa-ai') : esc_html__('no', 'prodexa-ai'); ?></td>
            </tr>
            <tr>
                <th><?php echo esc_html__('Status', 'prodexa-ai'); ?></th>
                <td><?php echo esc_html((string) ($snapshot['status'] ?: '—')); ?></td>
            </tr>
            <tr>
                <th><?php echo esc_html__('Plan', 'prodexa-ai'); ?></th>
                <td><?php echo esc_html(trim((string) $snapshot['plan_name'] . ' ' . (string) $snapshot['plan_code']) ?: '—'); ?></td>
            </tr>
            <tr>
                <th><?php echo esc_html__('Expires', 'prodexa-ai'); ?></th>
                <td><?php echo esc_html((string) ($snapshot['expires_at'] ?: '—')); ?></td>
            </tr>
            <tr>
                <th><?php echo esc_html__('Last request ID', 'prodexa-ai'); ?></th>
                <td><?php echo esc_html((string) ($snapshot['request_id'] ?: '—')); ?></td>
            </tr>
            <tr>
                <th><?php echo esc_html__('Checked at', 'prodexa-ai'); ?></th>
                <td><?php echo esc_html((string) ($snapshot['checked_at'] ?: '—')); ?></td>
            </tr>
            <?php if (!empty($snapshot['error_code'])) : ?>
                <tr>
                    <th><?php echo esc_html__('Last error', 'prodexa-ai'); ?></th>
                    <td><?php echo esc_html((string) $snapshot['error_code'] . ': ' . (string) $snapshot['message']); ?></td>
                </tr>
            <?php endif; ?>
        </tbody>
    </table>
    <form method="post" action="" style="margin-top: 12px;">
        <?php wp_nonce_field($view['license_action']); ?>
        <input type="hidden" name="prodexa_ai_action" value="license" />
        <?php submit_button(__('Refresh license status', 'prodexa-ai'), 'secondary', 'submit', false); ?>
    </form>
</div>

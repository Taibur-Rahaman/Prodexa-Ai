<?php
/**
 * Storefront discovery search shell. Result markup is created in JavaScript with textContent.
 *
 * @package Prodexa_AI
 *
 * @var array{input_id: string, limit: int} $view
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

$input_id = $view['input_id'];
$limit = (int) $view['limit'];
?>
<div
    class="prodexa-ai-search"
    data-prodexa-search
    data-limit="<?php echo esc_attr((string) $limit); ?>"
>
    <form class="prodexa-ai-search__form" data-prodexa-form>
        <label class="prodexa-ai-search__label" for="<?php echo esc_attr($input_id); ?>">
            <?php echo esc_html__('Search products', 'prodexa-ai'); ?>
        </label>
        <div class="prodexa-ai-search__row">
            <input
                class="prodexa-ai-search__input"
                type="search"
                id="<?php echo esc_attr($input_id); ?>"
                name="q"
                maxlength="200"
                autocomplete="off"
                spellcheck="false"
                required
                data-prodexa-query
            />
            <button class="prodexa-ai-search__submit" type="submit">
                <?php echo esc_html__('Search', 'prodexa-ai'); ?>
            </button>
        </div>
    </form>
    <div
        class="prodexa-ai-search__status"
        data-prodexa-status
        role="status"
        aria-live="polite"
    ></div>
    <div class="prodexa-ai-search__results" data-prodexa-results></div>
    <nav
        class="prodexa-ai-search__pager"
        data-prodexa-pager
        hidden
        aria-label="<?php echo esc_attr__('Search results pages', 'prodexa-ai'); ?>"
    ></nav>
    <noscript>
        <p><?php echo esc_html__('Product search needs JavaScript. The rest of the store still works.', 'prodexa-ai'); ?></p>
    </noscript>
</div>

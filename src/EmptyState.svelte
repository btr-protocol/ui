<script>
  // Empty / zero-result state: title + one line of text + optional action.
  // `loading` swaps the icon for the shared spinner: the one "still fetching" look.
  import Icon from './Icon.svelte'
  import Spinner from './Spinner.svelte'
  let { title = '', text = '', icon = '', loading = false, compact = false, action } = $props()
</script>

<div class="empty" class:compact role={loading ? 'status' : undefined} aria-busy={loading || undefined}>
  {#if loading}<Spinner size={24} />{:else if icon}<Icon name={icon} size="28" />{/if}
  {#if title}<h3>{title}</h3>{/if}
  {#if text}<p>{text}</p>{/if}
  {@render action?.()}
</div>

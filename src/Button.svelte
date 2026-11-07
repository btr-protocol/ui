<script>
  // The one action button: global button styling (kit.css) + a `pending` state.
  // Pending / disabled = aria-disabled + a click guard (never native `disabled`), so
  // keyboard focus survives and screen readers still reach the button. Pending adds an
  // inline spinner + optional pendingLabel in place (no layout move); `why` explains a
  // disabled state (tooltip + aria-describedby).
  import Spinner from './Spinner.svelte'
  let { pending = false, pendingLabel = '', disabled = false, why = '', iconOnly = false, title = undefined, class: cls = '', onclick = undefined, children, ...rest } = $props()
  const blocked = $derived(pending || disabled)
  const hint = $props.id()
</script>

<button {...rest} class={cls} class:pending aria-disabled={blocked || undefined} aria-busy={pending || undefined}
  aria-describedby={why && disabled && !pending ? hint : undefined} title={disabled && !pending && why ? why : title}
  onclick={(e) => { if (blocked) { e.preventDefault(); return } onclick?.(e) }}>
  {#if pending}<span class="bspin" aria-hidden="true"><Spinner size={14} inline /></span>{/if}
  {#if pending && pendingLabel}{pendingLabel}{:else if !(pending && (iconOnly || /\bicon\b/.test(cls)))}{@render children?.()}{/if}
</button>{#if why && disabled && !pending}<span id={hint} class="sr">{why}</span>{/if}

<style>
  .bspin { display: inline-grid; }
</style>

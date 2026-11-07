<script>
  // The one error surface: HTTP status + the server's own text + Retry. App-free: the host passes what it knows
  // (`diagnostics`: () => string for the copy button, `reconnecting`: the silent-read sentinel to explain).
  import Button from './Button.svelte'
  // `error` is a string ("HTTP 502 · text", as produced by api.errorText) or an Error with .status.
  let { error = '', onRetry = null, note = '', compact = false, diagnostics = null, reconnecting = '' } = $props()
  let retrying = $state(false)
  async function retry() { retrying = true; try { await onRetry() } finally { retrying = false } }
  const text = $derived(typeof error === 'string' ? error : error?.status ? `HTTP ${error.status} · ${error.message}` : error?.message || '')
  // The silent-read sentinel is a state, not a message: say what it means.
  const raw = $derived(reconnecting && text === reconnecting ? 'Cannot reach the server. Still retrying.' : text)
  const parts = $derived(/^HTTP (\d{3}) · ([\s\S]*)$/.exec(raw))
</script>

{#if raw}
  <div class="errstate" class:compact role="alert">
    {#if parts}<span class="pill bad">HTTP {parts[1]}</span>{/if}
    <span class="errtext">{parts ? parts[2] : raw}</span>
    {#if note}<span class="dim">{note}</span>{/if}
    {#if onRetry}<Button pending={retrying} pendingLabel="Retrying…" onclick={retry}>Retry</Button>{/if}
    {#if diagnostics}<button class="ghost dim" onclick={() => navigator.clipboard?.writeText(diagnostics()).catch(() => {})}>Copy diagnostics</button>{/if}
  </div>
{/if}

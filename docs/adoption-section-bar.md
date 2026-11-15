# SectionBar / SearchField adoption plan (the consolidation plan: which header, search and select moves to which kit piece)

Kit: `Table` gains `bar={{ title, start, end, searchSide, label }}` (replaces `title`/`meta`; the table's own search is built in).
Non-table cards use `<SectionBar>` directly in place of `PanelHeader`. Note: the front carries its own copies of Panel/Table/SearchInput in
`front/src/components/ui/`; those take the change when the kit version is synced.

## Front: Table headers (title / meta / search) -> `bar`
- front/src/components/features/oracle/oraclePanels.tsx:309 Feeds (title + LivePullMeta + search right)
- front/src/components/features/oracle/oraclePanels.tsx:595 Price update history
- front/src/components/features/metrics/FlowTable.tsx:225 Recent activity (meta holds a SegmentedControl: becomes a `end` cell)
- front/src/pages/metrics/MetricsTable.tsx:366 (no title: search sits OUTSIDE the frame above it today; becomes search-left bar)
- front/src/components/features/admin/ArbTab.tsx:344, :376, :384 (Bots, Tokens, Fills); ArbTab.tsx:321 range SegmentedControl above them
- front/src/components/features/admin/ArbAttempts.tsx:146, :157
- front/src/components/features/admin/GasTab.tsx:149 (SegmentedControl at :130)
- front/src/components/features/admin/OracleSla.tsx:129, :139
- front/src/components/features/admin/OracleTab.tsx:159, :172 (range + tier SegmentedControls at :146-147)
- front/src/components/features/admin/SessionsTable.tsx:333 (also :102 untitled)
- front/src/components/features/admin/ActionsTab.tsx:536 Safeguard history; :320 table
- front/src/components/features/admin/AnalyticsTab.tsx:1010, :1022, :1045, :1067
- front/src/components/features/oracle/KeeperRosters.tsx:357
- front/src/components/shared/metrics/AssetBars.tsx:228
- front/src/pages/FaucetPage.tsx:347, front/src/pages/safety/SafetyLevers.tsx:253, :678 (untitled tables: search outside frame today)

## Front: PanelHeader cards (no table)
- front/src/pages/AdminPage.tsx:620, :681, :726, :774
- front/src/components/features/admin/AdminActions.tsx:363, :399
- front/src/components/features/admin/ActionsTab.tsx:203, :290
- front/src/components/features/oracle/SignerRoster.tsx:117
- front/src/components/features/oracle/KeeperRosters.tsx:238, :297, :337

## Front: toolbars (already the cell language, h-8 hand-rolled `PanelToolbar` / `.toolbar-btn`)
- front/src/components/features/chart/DrawingToolbar.tsx:536 (reference design; keeps its own cells, can sit on SectionBar once Dropdown triggers become modal selects)
- front/src/components/features/swap/DepthBookView.tsx:398
- front/src/components/features/swap/SwapForm.tsx:2371

## Front: PageToolbar / search outside a section
- front/src/pages/OraclePage.tsx:167-169 (SegmentedControl in page toolbar)
- front/src/pages/MetricsPage.tsx:602-605
- front/src/pages/BlogPage.tsx:121 (page-level search; leave, not a section header)
- front/src/pages/pools/PoolsTableView.tsx (`header=` slot of the virtual pools grid, `headerClassName="bg-bg-3"`): the filter row of PoolsTable

## Safe app (multisig-proposer/web/src)
- pages/ActionsPage.tsx:68-69 (SegmentedControl + SearchInput in a loose row above the list: one bar, search right)
- pages/VaultPage.tsx:87-88 (Table title `vLegs`), :110
- components/SignersTab.tsx:39-40 (Table title with threshold, meta with nonce)
- components/SafeList.tsx:54 (Table, search outside)
- components/ActivityFeed.tsx:118 (filter SegmentedControl above the feed: start cell)
- components/HoldingsChart.tsx:185-188 (range + view SegmentedControls)
- components/ReviewView.tsx:25, components/Flow.tsx:63, components/AddressBookUpdate.tsx:42 (Tables)
- components/SafeDetail.tsx:47 (overview/activity tabs)

# Search: one core (`SearchField`), three variants

Kit already routes every search through `SearchInput` -> now `SearchField` (BaseModal header, SelectionModal / SelectModal / MultiSelectModal, WalletModal, CommandPalette,
MasterDetail, SelectionList, Table). `MultiInput` (`type="text"` chips) and `AddressField` are value inputs, not searches: not folded.
Variants: `bar` = SectionBar cell, `modal` = modal / list header, `boxed` = standalone. Paths below are the CONSUMERS (they keep working unchanged through the kit).

## Front (front/src)
- modal: components/features/search/SearchModal.tsx:341 (`headerType="input"`, global search)
- modal: components/features/modals/SettingsModal.tsx:237 (Search settings)
- modal: components/features/modals/NotificationsModal.tsx:220 (Search notifications; filter at :230 `FilterButton` -> multi modal select)
- modal: token / pool / asset / network pickers via `SelectionModal` (components/shared/token/PairSelector.tsx:223, ChainSelect usages: layout/Header.tsx:268, layout/TabBar.tsx:130, pages/MetricsPage.tsx:616)
- bar (Table search, becomes the bar's search cell): components/features/oracle/oraclePanels.tsx:309 Feeds (right), pages/metrics/MetricsTable.tsx:366 (left, was outside the frame),
  components/features/admin/OracleSla.tsx:135, OracleTab.tsx:167, ArbAttempts.tsx:163, ArbTab.tsx:407, AnalyticsTab.tsx:1017, :1029, :1062, :1084, ActionsTab.tsx:575
- bar, no search today (`searchable={false}`, stays without): pages/safety/SafetyLevers.tsx:257, :682, components/features/admin/SessionsTable.tsx:380 (server-paginated), AdminActions.tsx:457, shared/metrics/AssetBars.tsx:234
- boxed (page-level, no bar or modal header): pages/BlogPage.tsx:121
- the header magnifier at components/layout/Header.tsx:157 is a button that opens SearchModal, not a field

## Safe app (multisig-proposer/web/src)
- bar (search right, with the category tabs as a start cell): pages/ActionsPage.tsx:68-69 (loose row above the list today)
- modal: every `Pick` (components/Pick.tsx) is the kit modal select
- `searchable={false}` tables, stay without: pages/VaultPage.tsx:89, :111, components/ReviewView.tsx:27, SafeList.tsx:57, AddressBookUpdate.tsx:44, SignersTab.tsx:47, Flow.tsx:65

# Dropdowns / popovers -> modal select (mobile first)

SectionBar filter cells are `SelectModal` / `MultiSelectModal` triggers only (no Dropdown cell variant). Target per call site: SINGLE = `SelectModal`, MULTI = `MultiSelectModal`,
SEG = `SegmentedControl` (2-3 options, always visible: a modal for two choices is a tap too many).

## Front
- components/shared/MetricsWindowSelect.tsx:17 metrics window: SINGLE
- components/shared/AmountUnitSelect.tsx:19 USD / Tokens: SEG (2 options)
- components/features/oracle/oraclePanels.tsx:604 feed picker: SINGLE (searchable, many feeds)
- components/features/modals/SettingsModal.tsx:145 setting options: SINGLE (SEG where a setting has <= 3 options)
- components/features/admin/AnalyticsFilters.tsx:202 duration: SINGLE (SEG if <= 3 items)
- components/features/admin/ActionsTab.tsx:487 action kind: SINGLE
- pages/SafetyPage.tsx:315, :418, :434, :448 native `Select` (asset, pool, timelocked op, queued asset): SINGLE (searchable)
- pages/safety/SafetyLevers.tsx:408 native `Select`: SINGLE
- pages/V1ExitPage.tsx:535 native `Select`: SINGLE
- components/features/admin/SessionsTable.tsx:353 native `Select`: SINGLE
- components/features/admin/AnalyticsTab.tsx:900 native `Select`: SINGLE
- components/features/modals/NotificationsModal.tsx:230 `FilterButton`: MULTI
- components/shared/token/PairSelector.tsx:223 `FilterButton`: MULTI
- components/layout/Header.tsx:209 header menu (`moreEntries`, navigation links): stays a menu (`ClickMenu`: it is navigation, not a value)
- components/layout/Header.tsx:268, layout/TabBar.tsx:130, pages/MetricsPage.tsx:616 `ChainSelect`: already the modal select
- components/features/docs/ArticleToolbar.tsx:99 "open in AI service" action list: stays a `ClickMenu` (a list of actions, no selected value)
- components/features/swap/SwapForm.tsx:2383 order type (market / limit / stop): SEG (3 options, swap form; swap-chart exception does not cover the form)
- components/features/swap/DepthBookView.tsx:407, :415 denomination / view: SEG (2-3 options); xs inline toggles in a panel toolbar

## Excluded (stay as they are)
- components/features/chart/DrawingToolbar.tsx:140, :566, :598, :617, :635, :654, :683, :730, :774: the swap chart toolbar (owner exception): dense tool popovers with icons, hover-open palettes.
- components/shared/metrics/HealthPopover.tsx:59 (`Popover`): an info panel, not a select.
- components/features/modals/SlippageControl.tsx:81: an explanatory popover with a numeric field, not a select; revisit with the swap form.

## Safe app
- components/ActivityFeed.tsx:119 `ChainMultiSelect`, HeaderControls.tsx:38 and SignersTab.tsx:43 `ChainSelect`, components/Pick.tsx: already modal selects
- components/BatchBar.tsx:75, components/Tray.tsx:47 `ClickMenu` ("more actions"): action menus, stay
- components/HoldingsChart.tsx:185-188 phone already switches range to `SelectModal`; keep

## Button unify (kit 0.16.0): app migration
- Codemod: `leftIcon={X}` -> `icon={X}`; `rightIcon={X}` -> `icon={X} iconPosition="end"`; `size="default"` -> `size="md"`. Icon-only Buttons need `aria-label` (compile error otherwise); drop every `h-*`/`w-*`/`px-*` className on a Button (ui-lint rejects them).
- Delete front copies of `CloseButton`, `HoldButton`, `ExportButton` and the kit-duplicate icon buttons; import the kit's. `CloseButton` has no `size` prop.
- SigningCard `wide` (JS width check) -> `collapse` on the secondary actions; the primary never collapses.
- A `ButtonGroup` that may be narrower than its content takes `wrap` (cells never shrink below their label). `collapse` needs an `icon`.
- Bars and groups: no per-cell padding or radius classes; cells get their geometry from `SectionBar` / `.btn-group`. Plain refresh cells next to "Export" become `<Button variant="ghost" size="sm" aria-label="Refresh" icon={<Icon name="refresh-cw"/>}/>`.
- Both-sided triggers (chain glyph + caret, wallet glyph + caret): glyph into children, caret is the single `icon` with `iconPosition="end"`.
- Front `.toolbar-btn` (`front/tailwind.config.js:137`): stays while `DrawingToolbar` (excluded, owner exception) uses it; delete only if that toolbar moves. The kit no longer ships `.toolbar-btn` / `.toolbar-item`.
- Safe app is the clean consumer: no changes beyond the codemod.

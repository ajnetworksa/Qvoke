# Qvoke ERP Updates - Batch C

## Short Summary
Fixed critical draft persistence bugs causing old quotation data to load for new quotes, implemented missing UI components for Invoice markup editing to achieve feature parity with Quotations, and optimized document routing.

## Long Summary
1. **Invoice Editor UI Parity**: 
   - Brought `InvoiceDetail.tsx` up to feature parity with `QuotationDetail.tsx` by adding advanced Pricing Markup (M.U. %) logic.
   - Introduced the dynamic Analysis Sidebar into the Invoice editor, allowing line-by-line margin and rule overrides (INCL/EXCL/MAN/DB).
   - Synced DOM refs and introduced the `ResizeObserver` engine to map Line Items grid heights to the Analysis Sidebar pixel-perfectly.
   - Wired default global settings to retrieve default markup percentage from `api/settings/defaultMarkupPercentage`.

2. **Routing & Draft Persistence Bug Fix (Critical)**:
   - Addressed a severe bug where navigating to a different Quotation or Invoice ID (or clicking "New") while a local draft was present would cause the old form state to overwrite the new document's draft.
   - By adding an explicit React `key={recordId || 'new'}` parameter to both `<QuotationDetail>` and `<InvoiceDetail>` components inside the App Router, React is now forced to safely unmount and destroy all stale state before remounting the newly requested document.
   - This prevents "leaking" the old devices or line items into a newly created quotation and correctly clears all transient `isDirty` states.

3. **Performance**:
   - `useEffect` rules for draft persistence are now isolated successfully.
   - Side-by-side table heights calculate accurately via `requestAnimationFrame` and CSS box-sizing logic.

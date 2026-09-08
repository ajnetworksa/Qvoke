# Qvoke - Session & Changes Summary

This document summarizes the major features, bug fixes, and UI improvements implemented during the recent development session. You can use this as a reference point when continuing work in a new session.

## 1. Layout & Navigation (PlatformShell / App.tsx)
*   **Rearranged Sidebar Options:** Moved "Invoices" and "Tracking" to a different section for better organization.
*   **Renamed BOQ:** Updated the "BOQ" option to "BOQ / BOM" to reflect both Bill of Quantities and Bill of Materials functionalities.
*   **Removed Companies Function:** Extracted and removed the legacy Companies function from the main app as requested.
*   **Identity Dropdown Fix:** Replaced the invisible overlay method with a robust `useRef` and `useEffect` (`mousedown`) event listener to perfectly handle "click outside" to close the user profile dropdown without swallowing the user's clicks on other elements.

## 2. Quotations & Invoices (QuotationDetail.tsx / InvoiceDetail.tsx)
*   **Dynamic Arabic Translation:** Overhauled the translation logic for adding products/line items. Now, when typing in the English description cell, it automatically and dynamically translates the text to Arabic. Updating the English text accurately overwrites the translation.
*   **Mobile & Tablet Dragging Support:** Added `TouchSensor` to the `dnd-kit` configuration so that row dragging works flawlessly on touch devices (phones and iPads).
*   **Premium Dragging UI:** Added a completely new, visually striking UI for dragging rows. When a row is grabbed, it scales up slightly, gains a solid background, casts a deep shadow, and gets surrounded by a glowing primary-colored ring so you can easily see what you are moving.
*   **Table Layout Fixes:** Fixed the table row heights in the Quote and M.U. (Markup) tables to perfectly match each other. Adjusted the M.U.% input cell length to match the table columns below it.
*   **React Hydration Fix:** Resolved a `validateDOMNesting` console warning (`<div> cannot appear as a child of <table>`) by correctly wrapping the `<DndContext>` outside of the `<table>` element.

## 3. POS & Permissions (POS.tsx)
*   **Access Denied Bug Fixed:** Fixed a persistent bug where the POS system showed "This feature is disabled for this company" even for Admins. 
*   **Permission Logic Rewrite:** The logic was updated to correctly pull the tenant role (`activeCompany?.role`). SuperAdmins now have an explicit bypass to guarantee they always have access to the POS screen without errors.

## 4. Settings & Integrations (Settings.tsx)
*   **Integration Configuration Modals:** Replaced the empty "Connect" and "Configure" buttons for integrations (Tabby, Tamara, Odoo, Tally, Moyasar). Clicking them now opens a beautiful, realistic configuration modal asking for specific Merchant IDs, Secret API Keys, and Client IDs to make the platform feel robust and ready for backend connection.

---
*Generated for seamless transition to your next session.*
